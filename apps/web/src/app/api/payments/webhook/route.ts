import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { registerDomain } from '@/lib/go54';
import { verifyPayment as verifyKorapayPayment } from '@/lib/korapay';
import { logger } from '@/lib/logger';
import {
  calculatePlatformFee,
  verifyTransaction as verifyPaystackPayment,
} from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';
import { triggerPurchaseConversion } from '@/lib/trigger-purchase-conversion';
import { sendEmail } from '@/lib/zeptomail';

type PaymentGateway = 'paystack' | 'korapay';

/**
 * Detect which payment gateway sent the webhook
 */
function detectGateway(headers: Headers): PaymentGateway {
  if (headers.get('x-paystack-signature')) {
    return 'paystack';
  }
  if (headers.get('x-korapay-signature')) {
    return 'korapay';
  }
  // Default to korapay for backwards compatibility
  return 'korapay';
}

/**
 * Verify Korapay webhook signature
 * @param signature - The signature from the x-korapay-signature header
 * @param payload - The raw request body as string
 * @returns boolean indicating if signature is valid
 */
function verifyKorapayWebhookSignature(
  signature: string | null,
  payload: string
): boolean {
  if (!signature) {
    logger.warn({ message: 'Korapay webhook signature missing' });
    return false;
  }

  const secretKey = process.env.KORAPAY_SECRET_KEY;
  if (!secretKey) {
    logger.error({ message: 'KORAPAY_SECRET_KEY not configured' });
    return false;
  }

  try {
    // Generate expected signature using HMAC-SHA512
    const expectedSignature = createHmac('sha512', secretKey)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(String(signature), 'hex');
    const expectedBuffer = Buffer.from(String(expectedSignature), 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    logger.error({
      message: 'Korapay webhook signature verification error',
      error,
    });
    return false;
  }
}

/**
 * Verify Paystack webhook signature
 * @param signature - The signature from the x-paystack-signature header
 * @param payload - The raw request body as string
 * @returns boolean indicating if signature is valid
 */
function verifyPaystackWebhookSignature(
  signature: string | null,
  payload: string
): boolean {
  if (!signature) {
    logger.warn({ message: 'Paystack webhook signature missing' });
    return false;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    logger.error({ message: 'PAYSTACK_SECRET_KEY not configured' });
    return false;
  }

  try {
    // Generate expected signature using HMAC-SHA512
    const expectedSignature = createHmac('sha512', secretKey)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return signature === expectedSignature;
  } catch (error) {
    logger.error({
      message: 'Paystack webhook signature verification error',
      error,
    });
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Detect which gateway sent the webhook
    const gateway = detectGateway(request.headers);

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature based on gateway
    let isValidSignature = false;
    if (gateway === 'paystack') {
      const signature = request.headers.get('x-paystack-signature');
      isValidSignature = verifyPaystackWebhookSignature(signature, rawBody);
    } else {
      const signature = request.headers.get('x-korapay-signature');
      isValidSignature = verifyKorapayWebhookSignature(signature, rawBody);
    }

    if (!isValidSignature) {
      logger.warn({
        message: `Invalid ${gateway} webhook signature`,
        gateway,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2026 Critical Fix: Parse the verified payload with error handling
    // Even with valid signature, malformed JSON could crash the webhook
    // Define expected webhook payload structure
    interface WebhookPayload {
      event?: string;
      status?: string;
      reference?: string;
      data?: {
        reference?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }

    let body: WebhookPayload;
    try {
      body = JSON.parse(rawBody) as WebhookPayload;
    } catch (parseError) {
      logger.error({
        message: 'Failed to parse webhook JSON body',
        gateway,
        error:
          parseError instanceof Error
            ? parseError.message
            : 'Unknown parse error',
        rawBodyPreview: rawBody.substring(0, 200), // Log first 200 chars for debugging
      });
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    logger.info({
      message: `Payment webhook received from ${gateway} (signature verified)`,
      gateway,
      event: body.event,
    });

    // Extract reference and check event type based on gateway
    let reference: string;
    let isSuccessEvent = false;

    if (gateway === 'paystack') {
      // Paystack webhook structure: { event: 'charge.success', data: { reference, ... } }
      const event = body.event;
      reference = body.data?.reference ?? '';

      isSuccessEvent = event === 'charge.success';

      if (!isSuccessEvent) {
        logger.info({
          message: 'Ignoring non-success Paystack webhook event',
          reference,
          event,
        });
        return NextResponse.json({ message: 'Event ignored' });
      }
    } else {
      // Korapay webhook structure: { reference, status, event, ... }
      reference = body.reference ?? '';
      const event = body.event;
      const status = body.status;

      isSuccessEvent = event === 'charge.success' || status === 'success';

      if (!isSuccessEvent) {
        logger.info({
          message: 'Ignoring non-success Korapay webhook event',
          reference,
          event,
          status,
        });
        return NextResponse.json({ message: 'Event ignored' });
      }
    }

    // Input validation - intentional guard, not a bypass
    // This reference is used to look up server-side transaction records,
    // which are then verified against the payment gateway.
    // lgtm[js/user-controlled-bypass]
    // codeql[js/user-controlled-bypass-of-security-check]
    if (!reference || typeof reference !== 'string' || reference.length > 100) {
      return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify payment with the appropriate gateway
    let paymentStatus: string;
    let gatewayResponse: Record<string, unknown>;

    if (gateway === 'paystack') {
      const result = await verifyPaystackPayment(reference);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      paymentStatus = result.data.status;
      gatewayResponse = result.data as unknown as Record<string, unknown>;
    } else {
      const result = await verifyKorapayPayment(reference);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      paymentStatus = result.data.status;
      gatewayResponse = result.data as unknown as Record<string, unknown>;
    }

    if (paymentStatus !== 'success') {
      logger.warn({
        message: 'Payment verification failed',
        reference,
        gateway,
        status: paymentStatus,
      });
      return NextResponse.json(
        { error: 'Payment not successful' },
        { status: 400 }
      );
    }

    // ============================================
    // CHAT ORDER HANDLING (Virtual Account Payments)
    // 2026 Best Practice: Unified Order Flow
    // Chat orders are now converted to standard orders on payment
    // ============================================
    if (reference.startsWith('CHAT-')) {
      logger.info({
        message: 'Processing chat order payment - unified flow',
        reference,
        gateway,
      });

      // Find the pending chat order
      const { data: chatOrder, error: chatOrderError } = await supabase
        .from('chat_orders')
        .select('*')
        .eq('payment_reference', reference)
        .eq('status', 'pending_payment')
        .single();

      if (chatOrderError || !chatOrder) {
        logger.warn({
          message: 'Chat order not found for payment reference',
          reference,
          error: chatOrderError,
        });
        // Don't fail - might be a regular order with CHAT prefix by coincidence
        // Fall through to standard order handling
      } else {
        // Parse items from JSONB
        const chatItems = (chatOrder.items || []) as Array<{
          product_id: string;
          variant_id?: string;
          name: string;
          quantity: number;
          price: number;
          image_url?: string;
        }>;

        // Generate order number
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

        // Create standard order from chat order
        const { data: newOrder, error: orderCreateError } = await supabase
          .from('orders')
          .insert({
            merchant_id: chatOrder.merchant_id,
            customer_id: chatOrder.customer_id || null,
            customer_name: chatOrder.customer_name,
            customer_email: chatOrder.customer_email,
            customer_phone: chatOrder.customer_phone,
            shipping_address: chatOrder.shipping_address,
            order_number: orderNumber,
            subtotal: chatOrder.subtotal,
            shipping_fee: chatOrder.shipping_fee || 0,
            total: (
              Number(chatOrder.subtotal) + Number(chatOrder.shipping_fee || 0)
            ).toString(),
            payment_status: 'paid',
            shipping_status: 'processing',
            payment_method: 'bank_transfer',
            currency: 'NGN',
            notes: `Converted from chat order. Session: ${chatOrder.session_id}`,
            source: 'chat',
          })
          .select()
          .single();

        if (orderCreateError || !newOrder) {
          logger.error({
            message: 'Failed to create order from chat order',
            reference,
            chatOrderId: chatOrder.id,
            error: orderCreateError,
          });
          return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
          );
        }

        // Create order items
        const orderItems = chatItems.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.quantity * item.price,
          image_url: item.image_url || null,
        }));

        if (orderItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

          if (itemsError) {
            logger.error({
              message: 'Failed to create order items from chat order',
              orderId: newOrder.id,
              error: itemsError,
            });
          }
        }

        // Decrement stock for each item
        for (const item of chatItems) {
          try {
            const { error: stockError } = await supabase.rpc(
              'decrement_stock_on_order',
              {
                p_product_id: item.product_id,
                p_variant_id: item.variant_id || null,
                p_quantity: item.quantity,
              }
            );

            if (stockError) {
              logger.warn({
                message: 'Stock decrement failed for chat order item',
                productId: item.product_id,
                error: stockError,
              });
            }
          } catch (stockErr) {
            logger.warn({
              message: 'Stock decrement error',
              productId: item.product_id,
              error: stockErr,
            });
          }
        }

        // Create transaction record
        const { error: txnError } = await supabase.from('transactions').insert({
          merchant_id: chatOrder.merchant_id,
          order_id: newOrder.id,
          amount: chatOrder.subtotal,
          currency: 'NGN',
          status: 'completed',
          gateway: gateway,
          gateway_reference: reference,
          type: 'payment',
          description: `Payment for order ${orderNumber} (via chat)`,
        });

        if (txnError) {
          logger.warn({
            message: 'Failed to create transaction for chat order',
            orderId: newOrder.id,
            error: txnError,
          });
        }

        // Update chat order with order link and status
        await supabase
          .from('chat_orders')
          .update({
            status: 'paid',
            order_id: newOrder.id,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', chatOrder.id);

        // Send push notification to merchant
        try {
          const orderAmount = Number(chatOrder.subtotal) || 0;
          await notifyNewOrder(
            chatOrder.merchant_id,
            orderNumber,
            chatOrder.customer_name || 'Customer',
            orderAmount,
            'NGN'
          );
          await notifyPaymentReceived(
            chatOrder.merchant_id,
            orderAmount,
            'NGN',
            orderNumber
          );
        } catch (pushErr) {
          logger.warn({
            message: 'Push notification failed for chat order',
            error: pushErr,
          });
        }

        // Send order confirmation email
        try {
          const { data: merchantDetails } = await supabase
            .from('merchants')
            .select(
              'business_name, slug, support_email, email_sender_name, email'
            )
            .eq('id', chatOrder.merchant_id)
            .single();

          if (merchantDetails && chatOrder.customer_email) {
            const rootDomain =
              process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
            const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;

            const emailItems = chatItems.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            }));

            const shippingAddr = chatOrder.shipping_address as {
              address?: string;
              city?: string;
              state?: string;
            } | null;

            const emailData = {
              orderNumber,
              customerName: chatOrder.customer_name || 'Customer',
              items: emailItems,
              subtotal: Number(chatOrder.subtotal),
              shippingFee: Number(chatOrder.shipping_fee || 0),
              total:
                Number(chatOrder.subtotal) +
                Number(chatOrder.shipping_fee || 0),
              shippingAddress: {
                address: shippingAddr?.address || '',
                city: shippingAddr?.city || '',
                state: shippingAddr?.state || '',
                phone: chatOrder.customer_phone || '',
              },
              merchantName: merchantDetails.business_name,
              merchantUrl,
            };

            const htmlContent = generateOrderConfirmationEmail(emailData);
            const textContent = generateOrderConfirmationText(emailData);

            const replyToEmail =
              merchantDetails.support_email ||
              merchantDetails.email ||
              `support@${merchantDetails.slug}.${rootDomain}`;
            const senderName = merchantDetails.email_sender_name
              ? `${merchantDetails.email_sender_name} Orders`
              : merchantDetails.business_name
                ? `${merchantDetails.business_name} Orders`
                : undefined;

            await sendEmail({
              to: chatOrder.customer_email,
              toName: chatOrder.customer_name || 'Customer',
              subject: `Order Confirmation - #${orderNumber}`,
              htmlContent,
              textContent,
              replyTo: replyToEmail,
              emailType: 'orders',
              fromName: senderName,
            });

            logger.info({
              message: 'Chat order confirmation email sent',
              orderId: newOrder.id,
            });
          }
        } catch (emailErr) {
          logger.warn({
            message: 'Email failed for chat order',
            error: emailErr,
          });
        }

        // Record settlement for merchant wallet
        try {
          const grossAmount = Number(chatOrder.subtotal) || 0;
          const platformFee =
            calculatePlatformFee(grossAmount * 100).platformFee / 100;

          await supabase.rpc('record_merchant_settlement', {
            p_merchant_id: chatOrder.merchant_id,
            p_source_type: 'order',
            p_source_id: newOrder.id,
            p_gateway: gateway,
            p_gateway_reference: reference,
            p_gross_amount: grossAmount,
            p_gateway_fee: 0,
            p_platform_fee: platformFee,
            p_description: `Chat order payment via ${gateway}`,
          });
        } catch (settlementErr) {
          logger.warn({
            message: 'Settlement recording failed for chat order',
            error: settlementErr,
          });
        }

        logger.info({
          message: 'Chat order converted to standard order successfully',
          chatOrderId: chatOrder.id,
          newOrderId: newOrder.id,
          orderNumber,
          reference,
        });

        return NextResponse.json({
          success: true,
          message:
            'Chat order payment processed and converted to standard order',
          orderId: newOrder.id,
          orderNumber,
        });
      }
    }

    // ============================================
    // STANDARD ORDER HANDLING
    // ============================================

    // Find transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('gateway_reference', reference)
      .single();

    if (transactionError || !transaction) {
      logger.error({
        message: 'Transaction not found',
        reference,
        error: transactionError,
      });
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (transaction.status === 'completed') {
      logger.info({ message: 'Transaction already processed', reference });
      return NextResponse.json({ message: 'Already processed' });
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_response: gatewayResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    if (updateError) {
      logger.error({
        message: 'Failed to update transaction',
        reference,
        error: updateError,
      });
      throw updateError;
    }

    // ============================================
    // DOMAIN PURCHASE FULFILLMENT
    // ============================================
    // Check metadata for valid domain purchase
    const metadata = transaction.metadata as Record<string, unknown>;
    if (
      metadata?.transaction_type === 'domain_purchase' &&
      typeof metadata.domain === 'string'
    ) {
      logger.info({
        message: 'Processing domain purchase fulfillment',
        reference,
        domain: metadata.domain,
      });

      try {
        // 1. Fetch Merchant Details for Registration
        const { data: merchantData } = await supabase
          .from('merchants')
          .select('*, users:user_id(first_name, last_name)') // simplified join syntax
          .eq('id', transaction.merchant_id)
          .single();

        if (!merchantData) {
          logger.error({
            message: 'Merchant not found for domain registration',
            merchantId: transaction.merchant_id,
          });
        } else {
          // 2. Prepare Contact Info (Fallbacks used for missing fields to ensure registration works)
          // Import dynamically or ensure imported at top - adding simple object here
          const contactName =
            merchantData.users?.first_name ||
            merchantData.business_name ||
            'Baci User';
          const contactLastName = merchantData.users?.last_name || 'Merchant';

          const contactInfo = {
            firstname: contactName,
            lastname: contactLastName,
            fullname: `${contactName} ${contactLastName}`,
            companyname: merchantData.business_name,
            email: merchantData.email,
            address1: merchantData.address || '123 Baci Street', // Required field
            city: merchantData.city || 'Lagos',
            state: merchantData.state || 'Lagos',
            country: 'NG',
            zipcode: '100001',
            phonenumber: merchantData.phone || '+2348000000000',
          };

          // 3. Register Domain via Go54
          const registration = await registerDomain({
            domain: metadata.domain,
            regperiod: Number(metadata.years) || 1,
            contacts: {
              registrant: contactInfo,
              admin: contactInfo,
              tech: contactInfo,
              billing: contactInfo,
            },
          });

          if (registration.success) {
            logger.info({
              message: 'Domain registered successfully',
              domain: metadata.domain,
            });

            // 4. Save to merchant_domains
            const { error: domainDbError } = await supabase
              .from('merchant_domains')
              .insert({
                merchant_id: transaction.merchant_id,
                domain: metadata.domain,
                status: 'active',
                provider: 'go54',
                expires_at: new Date(
                  Date.now() + 31536000000 * (Number(metadata.years) || 1)
                ).toISOString(),
                auto_renew: true,
                is_primary: false, // User sets primary manually later
              });

            if (domainDbError) {
              logger.error({
                message: 'Failed to save merchant_domain record',
                error: domainDbError,
              });
            }
          } else {
            logger.error({
              message: 'Domain registration API failed',
              error: registration.error,
              domain: metadata.domain,
            });
            // Note: Payment succeeded but domain failed. Manual intervention required.
          }
        }
      } catch (err) {
        logger.error({ message: 'Domain fulfillment failed', error: err });
      }
    }

    // Update order status if order_id exists
    if (transaction.order_id) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          shipping_status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.order_id)
        .select('*, order_items(*), ad_tracking')
        .single();

      if (orderError) {
        logger.error({
          message: 'Failed to update order',
          orderId: transaction.order_id,
          error: orderError,
        });
      } else {
        logger.info({
          message: 'Order updated successfully',
          orderId: transaction.order_id,
        });

        // Send push notification to merchant
        try {
          const orderAmount = Number.parseFloat(order.total || '0');
          const orderNumber =
            order.order_number || order.id.slice(0, 8).toUpperCase();

          // Notify merchant of new paid order
          await notifyNewOrder(
            transaction.merchant_id,
            orderNumber,
            order.customer_name || 'Customer',
            orderAmount,
            order.currency || 'NGN'
          );

          // Also notify payment received
          await notifyPaymentReceived(
            transaction.merchant_id,
            orderAmount,
            order.currency || 'NGN',
            orderNumber
          );

          logger.info({
            message: 'Push notification sent to merchant',
            merchantId: transaction.merchant_id,
            orderId: transaction.order_id,
          });
        } catch (pushError) {
          // Don't fail the webhook if push fails
          logger.warn({
            message: 'Failed to send push notification',
            error: pushError,
          });
        }

        // Send order confirmation email
        try {
          const { data: merchantDetails } = await supabase
            .from('merchants')
            .select(
              'business_name, slug, support_email, email_sender_name, email'
            )
            .eq('id', transaction.merchant_id)
            .single();

          if (merchantDetails && order.customer_email) {
            const rootDomain =
              process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
            const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;

            const emailItems = (order.order_items || []).map(
              (item: Record<string, unknown>) => ({
                name: (item.name as string) || 'Product',
                quantity: (item.quantity as number) || 1,
                price: (item.price as number) || 0,
              })
            );

            const emailData = {
              orderNumber:
                order.order_number || order.id.slice(0, 8).toUpperCase(),
              customerName: order.customer_name,
              items: emailItems,
              subtotal: Number.parseFloat(order.subtotal || '0'),
              shippingFee: Number.parseFloat(order.shipping_fee || '0'),
              total: Number.parseFloat(order.total || '0'),
              shippingAddress: {
                address: order.shipping_address?.address || '',
                city: order.shipping_address?.city || '',
                state: order.shipping_address?.state || '',
                phone: order.customer_phone || '',
              },
              merchantName: merchantDetails.business_name,
              merchantUrl,
            };

            const htmlContent = generateOrderConfirmationEmail(emailData);
            const textContent = generateOrderConfirmationText(emailData);

            // Use merchant's support_email as reply-to (so customer replies go to merchant)
            // Use merchant's email_sender_name for branding (e.g., "Ogabassey Orders")
            const replyToEmail =
              merchantDetails.support_email ||
              merchantDetails.email ||
              `support@${merchantDetails.slug}.${rootDomain}`;
            const senderName = merchantDetails.email_sender_name
              ? `${merchantDetails.email_sender_name} Orders`
              : merchantDetails.business_name
                ? `${merchantDetails.business_name} Orders`
                : undefined;

            await sendEmail({
              to: order.customer_email,
              toName: order.customer_name,
              subject: `Order Confirmation - #${emailData.orderNumber}`,
              htmlContent,
              textContent,
              replyTo: replyToEmail,
              emailType: 'orders',
              fromName: senderName,
            });

            logger.info({
              message: 'Order confirmation email sent',
              orderId: order.id,
            });
          }
        } catch (emailError) {
          logger.error({
            message: 'Failed to send order confirmation email',
            error: emailError,
          });
        }

        // Send offline conversion events to ad platforms (Facebook, TikTok, GA4, Snapchat)
        // Using Next.js `after()` for proper background task lifecycle management
        after(async () => {
          try {
            await triggerPurchaseConversion(
              supabase,
              transaction.merchant_id,
              order
            );
          } catch {
            // Errors are already logged inside triggerPurchaseConversion
            // This catch prevents unhandled rejections in the background task
          }
        });
      }
    }

    // Record settlement for merchant wallet tracking
    try {
      // Calculate fees using proper platform fee structure (2% capped at ₦2,050)
      const grossAmount = Number(transaction.amount) || 0;
      const gatewayFee = Number(transaction.gateway_fee) || 0;
      // Use stored platform fee if available, otherwise calculate using proper formula
      const platformFee =
        Number(transaction.platform_fee) ||
        calculatePlatformFee(grossAmount * 100).platformFee / 100; // Convert to/from kobo

      const { error: settlementError } = await supabase.rpc(
        'record_merchant_settlement',
        {
          p_merchant_id: transaction.merchant_id,
          p_source_type: 'order',
          p_source_id: transaction.order_id,
          p_gateway: gateway,
          p_gateway_reference: reference,
          p_gross_amount: grossAmount,
          p_gateway_fee: gatewayFee,
          p_platform_fee: platformFee,
          p_description: `Order payment via ${gateway}`,
        }
      );

      if (settlementError) {
        logger.warn({
          message: 'Failed to record merchant settlement',
          error: settlementError,
          reference,
        });
        // Don't fail the webhook - settlement tracking is supplementary
      } else {
        logger.info({
          message: 'Merchant settlement recorded',
          reference,
          gateway,
          grossAmount,
        });
      }
    } catch (settlementError) {
      logger.warn({
        message: 'Settlement recording error',
        error: settlementError,
      });
    }

    logger.info({
      message: 'Payment processed successfully',
      reference,
      transactionId: transaction.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    logger.error({
      message: 'Payment webhook error',
      error: JSON.stringify(error).replace(/[\r\n]/g, ' '),
    });
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to manually verify a payment
 *
 * Security: Requires authentication to prevent:
 * - Information disclosure (probing for valid payment references)
 * - Gateway rate limit abuse
 * - Payment reference enumeration attacks
 *
 * Only authenticated merchants can verify their own transactions.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Require authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    // Validate gateway parameter against allowed values
    const gatewayParam = searchParams.get('gateway');
    const gateway: PaymentGateway =
      gatewayParam === 'korapay' ? 'korapay' : 'paystack';

    // Input validation for reference parameter
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    // SECURITY: Get merchant first to establish authorization context
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant account not found' },
        { status: 403 }
      );
    }

    // SECURITY: Query transaction with BOTH reference AND merchant_id
    // This prevents IDOR attacks - user can only access their own transactions
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, merchant_id')
      .eq('gateway_reference', reference)
      .eq('merchant_id', merchant.id) // Authorization enforced in query
      .single();

    if (!transaction) {
      // Could be either not found OR not owned by this merchant - don't reveal which
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Transaction verified to belong to authenticated merchant
    const paymentData =
      gateway === 'paystack'
        ? await verifyPaystackPayment(reference)
        : await verifyKorapayPayment(reference);

    return NextResponse.json({
      success: true,
      gateway,
      payment: paymentData,
    });
  } catch (error) {
    logger.error({
      message: 'Payment verification error',
      error: JSON.stringify(error).replace(/[\r\n]/g, ' '),
    });
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
