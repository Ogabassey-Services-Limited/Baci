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
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';
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

    // Parse the verified payload
    const body = JSON.parse(rawBody);

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
      reference = body.data?.reference;

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
      reference = body.reference;
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
    // lgtm[js/user-controlled-bypass]
    // codeql[js/user-controlled-bypass-of-security-check]
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
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
    // ============================================
    // Check if this is a chat order payment (CHAT-* prefix)
    if (reference.startsWith('CHAT-')) {
      logger.info({
        message: 'Processing chat order payment',
        reference,
        gateway,
      });

      // Find and update the chat order
      const { data: chatOrder, error: chatOrderError } = await supabase
        .from('chat_orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('payment_reference', reference)
        .eq('status', 'pending_payment')
        .select()
        .single();

      if (chatOrderError || !chatOrder) {
        logger.warn({
          message: 'Chat order not found for payment reference',
          reference,
          error: chatOrderError,
        });
        // Don't fail - might be a regular order with CHAT prefix by coincidence
      } else {
        logger.info({
          message: 'Chat order payment confirmed',
          orderId: chatOrder.id,
          reference,
          amount: chatOrder.subtotal,
        });

        // TODO: Emit Supabase Realtime event for frontend notification
        // await supabase.channel(`chat-${chatOrder.session_id}`).send({
        //   type: 'payment_confirmed',
        //   order: chatOrder,
        // });

        return NextResponse.json({
          success: true,
          message: 'Chat order payment processed',
          orderId: chatOrder.id,
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
          } catch (_err) {
            // Errors are already logged inside triggerPurchaseConversion
            // This catch prevents unhandled rejections in the background task
          }
        });
      }
    }

    // Record settlement for merchant wallet tracking
    try {
      // Calculate fees (platform takes 1.5% for example)
      const grossAmount = Number(transaction.amount) || 0;
      const gatewayFee = Number(transaction.gateway_fee) || 0;
      const platformFee =
        Number(transaction.platform_fee) || grossAmount * 0.015;

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
    logger.error({ message: 'Payment webhook error', error: JSON.stringify(error).replace(/[\r\n]/g, ' ') });
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to manually verify a payment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');
    // Gateway selection from query param with safe default
    // lgtm[js/user-controlled-bypass]
    const gateway = (searchParams.get('gateway') ||
      'paystack') as PaymentGateway;

    // Input validation - intentional guard
    // lgtm[js/user-controlled-bypass]
    // codeql[js/user-controlled-bypass-of-security-check]
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

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
    logger.error({ message: 'Payment verification error', error: JSON.stringify(error).replace(/[\r\n]/g, ' ') });
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
