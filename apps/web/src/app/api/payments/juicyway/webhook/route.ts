import { formatOrderItemDisplayName } from '@baci/shared/lib';
import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import {
  fetchAnalyticsPlatformConfig,
  hasConfiguredAnalyticsPlatform,
} from '@/lib/analytics/analytics-platform-config';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import {
  type JuicywayWebhookPayload,
  verifyWebhookSignature,
} from '@/lib/juicyway';
import { logger } from '@/lib/logger';
import {
  logConversionResults,
  type MerchantAnalyticsConfig,
  type OrderConversionData,
  sendPurchaseConversion,
} from '@/lib/offline-conversions';
import { ensurePaidOrderInventoryConfirmed } from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { fileInventoryConfirmationFailureReview } from '@/lib/payments/file-inventory-confirmation-review';
import {
  handlePaymentForCancelledOrder,
  isOrderClampedAsCancelled,
} from '@/lib/payments/handle-payment-for-cancelled-order';
import { handleJuicywayWalletTopUpIfNeeded } from '@/lib/payments/juicyway-wallet-top-up';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';

// Juicyway webhook IP whitelist (from docs)
const JUICYWAY_IPS = [
  '52.31.139.75',
  '52.49.173.169',
  '52.214.14.220',
  '18.203.70.158',
  '54.229.174.45',
  '52.212.54.134',
  '54.77.226.185',
  '52.18.78.91',
  '54.76.137.67',
  '52.51.85.69',
  '52.210.159.41',
];

// First release that persists Juicyway settlement amount/currency metadata on
// transaction creation. Older in-flight sessions were already signed by
// Juicyway but cannot be safely compared to new metadata that did not exist.
const JUICYWAY_SETTLEMENT_METADATA_REQUIRED_AFTER_MS = Date.parse(
  '2026-06-25T14:45:00.000Z'
);

function shouldRequireJuicywaySettlementMetadata(createdAt: unknown) {
  if (typeof createdAt !== 'string') {
    return true;
  }
  const createdAtMs = Date.parse(createdAt);
  return (
    !Number.isFinite(createdAtMs) ||
    createdAtMs >= JUICYWAY_SETTLEMENT_METADATA_REQUIRED_AFTER_MS
  );
}

/**
 * Logs whether the request originates from a known Juicyway IP. This is
 * observability only — it does NOT gate the request (the caller logs and
 * continues on a miss). HMAC signature verification is the actual security
 * control; the IP list can lag Juicyway's infra and proxies rewrite the source.
 */
function isFromJuicywayIP(request: NextRequest): boolean {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIP || '';

  // In development, allow all IPs
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return JUICYWAY_IPS.includes(ip);
}

export async function POST(request: NextRequest) {
  try {
    // Optional: IP whitelist check
    if (!isFromJuicywayIP(request)) {
      logger.warn({
        message: 'Juicyway webhook from non-whitelisted IP',
        ip:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip'),
      });
      // Continue processing but log it - don't reject in case of proxy issues
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const payload: JuicywayWebhookPayload = JSON.parse(rawBody);

    // Get business ID for signature verification
    const businessId = process.env.JUICYWAY_BUSINESS_ID;
    if (!businessId) {
      logger.error({ message: 'JUICYWAY_BUSINESS_ID not configured' });
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const { checksum, event, data } = payload;
    const isValid = await verifyWebhookSignature(
      event,
      data as unknown as Record<string, unknown>,
      checksum,
      businessId
    );

    if (!isValid) {
      logger.warn({ message: 'Invalid Juicyway webhook signature' });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    logger.info({
      message: 'Juicyway webhook received (signature verified)',
      event,
      reference: data.reference,
    });

    // Handle different event types
    if (event === 'payment.session.failed') {
      logger.info({
        message: 'Juicyway payment failed',
        reference: data.reference,
      });
      // Optionally update order status to failed
      return NextResponse.json({ message: 'Failure noted' });
    }

    if (event !== 'payment.session.succeeded') {
      logger.info({
        message: 'Ignoring non-success Juicyway event',
        event,
        reference: data.reference,
      });
      return NextResponse.json({ message: 'Event ignored' });
    }

    // Process successful payment
    const reference = data.reference;
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Find transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select(
        // Δ-0a: `gateway_fee` is not a column on `transactions`. Juicyway
        // verify webhooks have no fee field either, so settlement passes 0
        // (matches existing semantics).
        'id, order_id, merchant_id, amount, platform_fee, status, metadata, created_at'
      )
      .eq('gateway_reference', reference)
      .single();

    if (transactionError || !transaction) {
      logger.error({
        message: 'Transaction not found for Juicyway webhook',
        reference,
        error: transactionError,
      });
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const walletTopUpResponse = await handleJuicywayWalletTopUpIfNeeded({
      payment: data,
      reference,
      supabase: createAdminClient(),
      transaction,
    });
    if (walletTopUpResponse) return walletTopUpResponse;

    // Check if already processed (idempotency)
    if (transaction.status === 'completed') {
      if (transaction.order_id) {
        const { data: completedOrder } = await supabase
          .from('orders')
          .select('id, shipping_status, cancelled_at')
          .eq('id', transaction.order_id)
          .maybeSingle();

        if (isOrderClampedAsCancelled(completedOrder)) {
          await handlePaymentForCancelledOrder({
            gatewayReference: reference,
            order: completedOrder ?? { id: transaction.order_id },
            reason:
              'Juicyway completed-transaction retry observed a cancelled order',
            transactionId: transaction.id,
          });
        }
      }

      logger.info({ message: 'Transaction already processed', reference });
      return NextResponse.json({ message: 'Already processed' });
    }

    // Validate the settled amount against what we expected at session creation.
    // Juicyway is a stablecoin rail, so `data.amount` is in session-currency
    // minor units (USDT/USDC cents) — NOT the NGN order total — and the locked
    // FX rate means the expected amount was computed at checkout time. Reject
    // underpaid/wrong-currency settlements instead of trusting the success
    // event blindly (every other gateway enforces an amount/currency match).
    const txnMetadata = (transaction.metadata ?? {}) as Record<string, unknown>;
    const expectedAmount = Number(txnMetadata.juicyway_expected_amount);
    const expectedCurrency =
      typeof txnMetadata.juicyway_expected_currency === 'string'
        ? txnMetadata.juicyway_expected_currency
        : null;
    const settledAmount = Number(data.amount);
    const settledCurrency =
      typeof data.currency === 'string' && data.currency.trim().length > 0
        ? data.currency.trim()
        : null;
    const hasExpectedSettlementMetadata =
      txnMetadata.juicyway_expected_amount != null ||
      txnMetadata.juicyway_expected_currency != null;
    const requireExpectedSettlementMetadata =
      hasExpectedSettlementMetadata ||
      shouldRequireJuicywaySettlementMetadata(
        (transaction as { created_at?: unknown }).created_at
      );

    if (!Number.isFinite(settledAmount) || settledAmount <= 0) {
      logger.error({
        message: 'Juicyway payment amount missing or invalid',
        reference,
        expected: expectedAmount,
        received: data.amount,
      });
      return NextResponse.json(
        { error: 'Payment amount mismatch' },
        { status: 400 }
      );
    }

    if (!settledCurrency) {
      logger.error({
        message: 'Juicyway settled currency missing or invalid',
        reference,
        received: data.currency,
      });
      return NextResponse.json(
        { error: 'Payment currency mismatch' },
        { status: 400 }
      );
    }

    if (requireExpectedSettlementMetadata) {
      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        logger.error({
          message: 'Juicyway expected amount missing; rejecting settlement',
          reference,
        });
        return NextResponse.json(
          { error: 'Payment amount mismatch' },
          { status: 400 }
        );
      }

      if (!expectedCurrency) {
        logger.error({
          message: 'Juicyway expected currency missing; rejecting settlement',
          reference,
          received: data.currency,
        });
        return NextResponse.json(
          { error: 'Payment currency mismatch' },
          { status: 400 }
        );
      }

      if (expectedCurrency.toUpperCase() !== settledCurrency.toUpperCase()) {
        logger.error({
          message: 'Juicyway payment currency mismatch',
          reference,
          expected: expectedCurrency,
          received: settledCurrency,
        });
        return NextResponse.json(
          { error: 'Payment currency mismatch' },
          { status: 400 }
        );
      }

      // Allow overpayment + dust; reject clear underpayment (>1% short).
      // Stablecoins are ~1:1 USD, so the locked-rate expectation is exact
      // and the tolerance only absorbs on-chain rounding/dust.
      const UNDERPAYMENT_TOLERANCE = 0.01;
      if (settledAmount < expectedAmount * (1 - UNDERPAYMENT_TOLERANCE)) {
        logger.error({
          message: 'Juicyway payment amount mismatch (underpaid)',
          reference,
          expected: expectedAmount,
          received: settledAmount,
          currency: settledCurrency,
        });
        return NextResponse.json(
          { error: 'Payment amount mismatch' },
          { status: 400 }
        );
      }
    } else {
      logger.warn({
        message:
          'Processing legacy Juicyway settlement without expected metadata',
        reference,
        received: settledAmount,
        currency: settledCurrency,
      });
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_response: data as unknown as Record<string, unknown>,
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

    // Update order status if order_id exists
    if (transaction.order_id) {
      const response = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          shipping_status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.order_id)
        .select(
          'id, order_number, merchant_id, customer_id, total, subtotal, shipping_fee, customer_name, customer_email, customer_phone, shipping_address, currency, payment_status, shipping_status, cancelled_at, updated_at, ad_tracking, order_items(id, product_id, condition, name, price, quantity, variant_name)'
        )
        .single();

      const orderError = response.error;
      const order = response.data as {
        id: string;
        order_number: string;
        merchant_id: string;
        customer_id: string | null;
        total: string;
        subtotal: string;
        shipping_fee: string;
        customer_name: string;
        customer_email: string;
        customer_phone: string | null;
        shipping_address: {
          address?: string;
          city?: string;
          state?: string;
        } | null;
        currency: string;
        payment_status: string;
        shipping_status: string;
        cancelled_at: string | null;
        updated_at: string;
        ad_tracking: Record<string, unknown> | null;
        order_items: Array<{
          id: string;
          product_id: string;
          name: string;
          price: number;
          quantity: number;
          condition: string | null;
          variant_name: string | null;
        }>;
      } | null;

      if (orderError || !order) {
        logger.error({
          message: 'Failed to update order',
          orderId: transaction.order_id,
          error: orderError,
        });
      } else if (isOrderClampedAsCancelled(order)) {
        // The prevent_cancelled_order_reopen trigger clamped this reopen:
        // suppress all paid-order side effects (email, push, conversions,
        // settlement) and file a reconciliation row. Ack the gateway.
        await handlePaymentForCancelledOrder({
          gatewayReference: reference,
          order,
          reason:
            'Juicyway payment captured for an order cancelled before finalization',
          transactionId: transaction.id,
        });

        return NextResponse.json({
          success: true,
          message: 'Payment recorded; order was cancelled, filed for review',
        });
      } else {
        try {
          await ensurePaidOrderInventoryConfirmed(
            supabase,
            transaction.merchant_id,
            transaction.order_id
          );
        } catch (inventoryError) {
          const inventoryErrorMessage =
            inventoryError instanceof Error
              ? inventoryError.message
              : 'Inventory confirmation failed';

          logger.error({
            message: 'Juicyway webhook failed to confirm inventory',
            orderId: transaction.order_id,
            error: inventoryError,
          });
          try {
            await fileInventoryConfirmationFailureReview({
              gatewayReference: reference,
              merchantId: transaction.merchant_id,
              metadata: {
                gateway: 'juicyway',
                inventoryError: inventoryErrorMessage,
              },
              orderId: transaction.order_id,
              reason:
                'Juicyway payment was captured but serialized inventory confirmation failed',
              transactionId: transaction.id,
            });
          } catch (reviewError) {
            logger.error({
              message:
                'Juicyway webhook failed to file inventory confirmation review',
              orderId: transaction.order_id,
              error: reviewError,
            });
          }

          return NextResponse.json({
            success: true,
            message:
              'Payment recorded; inventory confirmation failed and was filed for review',
          });
        }

        logger.info({
          message: 'Order updated successfully via Juicyway',
          orderId: transaction.order_id,
        });

        // Send order confirmation email
        try {
          // Read merchant identity/branding via the service-role client. This
          // webhook has no user session (signature-verified, cookieless), so an
          // anon read here depends on the permissive `merchants` anon grant and
          // leaks tax_identification_number / cac_rc_number on the anon path.
          // The S0-A containment revokes that anon grant, so this must not run
          // as anon. (payments/webhook and payments/verify read merchants the
          // same way.)
          const { data: merchantDetails } = await createAdminClient()
            .from('merchants')
            .select(
              'business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
            )
            .eq('id', transaction.merchant_id)
            .single();

          if (merchantDetails && order.customer_email) {
            const rootDomain =
              process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
            const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;

            const emailItems = (order.order_items || []).map((item) => ({
              name: formatOrderItemDisplayName({
                baseName: item.name || 'Product',
                condition: item.condition,
                variantName: item.variant_name,
              }),
              quantity: item.quantity || 1,
              price: item.price || 0,
            }));

            const emailData = {
              orderNumber:
                order.order_number || order.id.slice(0, 8).toUpperCase(),
              customerName: order.customer_name,
              items: emailItems,
              subtotal: Number.parseFloat(order.subtotal || '0'),
              shippingFee: Number.parseFloat(order.shipping_fee || '0'),
              total: Number.parseFloat(order.total || '0'),
              currency: order.currency || 'NGN',
              shippingAddress: {
                address: order.shipping_address?.address || '',
                city: order.shipping_address?.city || '',
                state: order.shipping_address?.state || '',
                phone: order.customer_phone || '',
              },
              merchantName: merchantDetails.business_name,
              merchantUrl,
              merchantTin:
                merchantDetails.tax_identification_number ?? undefined,
              merchantRcNumber: merchantDetails.cac_rc_number ?? undefined,
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

            const emailResult = await sendEmail({
              to: order.customer_email,
              toName: order.customer_name,
              subject: `Order Confirmation - #${emailData.orderNumber}`,
              htmlContent,
              textContent,
              replyTo: replyToEmail,
              emailType: 'orders',
              fromName: senderName,
              auditContext: {
                merchantId: order.merchant_id,
                orderId: order.id,
                customerId: order.customer_id,
                metadata: {
                  trigger: 'juicyway_payment_confirmation',
                },
              },
            });

            if (!emailResult.success) {
              logger.error({
                message: 'Failed to send order confirmation email',
                orderId: order.id,
                emailError: emailResult.error,
                emailErrorCode: emailResult.errorCode,
                emailErrorDetails: emailResult.errorDetails,
              });
            } else {
              logger.info({
                message: 'Order confirmation email sent (Juicyway)',
                orderId: order.id,
                messageId: emailResult.messageId,
              });
            }
          }
        } catch (emailError) {
          logger.error({
            message: 'Failed to send order confirmation email',
            error: emailError,
          });
        }

        // Notify merchant of new order and payment (non-blocking)
        const orderNum =
          order.order_number || order.id.slice(0, 8).toUpperCase();
        const total = Number.parseFloat(order.total || '0');
        const currency = order.currency || 'NGN';
        const customerName = order.customer_name || 'Customer';
        after(async () => {
          try {
            await notifyNewOrder(
              transaction.merchant_id,
              order.id,
              orderNum,
              customerName,
              total,
              currency
            );
          } catch (err) {
            logger.error({
              message: 'New order push notification failed',
              error: err,
            });
          }

          try {
            await notifyPaymentReceived(
              transaction.merchant_id,
              total,
              currency,
              orderNum,
              order.id
            );
          } catch (err) {
            logger.error({
              message: 'Payment received push notification failed',
              error: err,
            });
          }
        });

        // Send offline conversion events to ad platforms
        try {
          const merchantAnalytics = await fetchAnalyticsPlatformConfig(
            supabase,
            transaction.merchant_id
          );

          if (merchantAnalytics?.offline_conversions_enabled === false) {
            logger.info({
              message: 'Offline conversions disabled by merchant',
              merchantId: transaction.merchant_id,
            });
          } else if (merchantAnalytics) {
            const analyticsConfig: MerchantAnalyticsConfig = {
              facebook_pixel_id: merchantAnalytics.facebook_pixel_id,
              facebook_capi_token: merchantAnalytics.facebook_capi_token,
              tiktok_pixel_id: merchantAnalytics.tiktok_pixel_id,
              tiktok_access_token: merchantAnalytics.tiktok_access_token,
              google_analytics_id: merchantAnalytics.google_analytics_id,
              ga4_api_secret: merchantAnalytics.ga4_api_secret,
              snapchat_pixel_id: merchantAnalytics.snapchat_pixel_id,
              snapchat_capi_token: merchantAnalytics.snapchat_capi_token,
            };

            if (hasConfiguredAnalyticsPlatform(merchantAnalytics)) {
              const adTracking = order.ad_tracking as Record<
                string,
                unknown
              > | null;

              const orderConversionData: OrderConversionData = {
                orderId: order.id,
                orderNumber:
                  order.order_number || order.id.slice(0, 8).toUpperCase(),
                total: Number.parseFloat(order.total || '0'),
                currency: order.currency || 'NGN',
                customerEmail: order.customer_email,
                customerPhone: order.customer_phone,
                customerName: order.customer_name,
                customerId: order.customer_id,
                items: (order.order_items || []).map(
                  (item: Record<string, unknown>) => ({
                    id:
                      (item.product_id as string) || (item.id as string) || '',
                    name: (item.name as string) || 'Product',
                    price: Number(item.price) || 0,
                    quantity: Number(item.quantity) || 1,
                  })
                ),
                fbclid: adTracking?.fbclid as string | undefined,
                fbp: adTracking?.fbp as string | undefined,
                ttp: adTracking?.ttp as string | undefined,
                gclid: adTracking?.gclid as string | undefined,
                sccid: adTracking?.sccid as string | undefined,
                gaClientId: adTracking?.gaClientId as string | undefined,
                userIp: adTracking?.userIp as string | undefined,
                userAgent: adTracking?.userAgent as string | undefined,
                eventId: adTracking?.eventId as string | undefined,
                limitedDataUse: adTracking?.limitedDataUse as
                  | boolean
                  | undefined,
              };

              sendPurchaseConversion(analyticsConfig, orderConversionData)
                .then((results) => {
                  try {
                    logConversionResults(
                      orderConversionData.orderNumber,
                      results
                    );
                  } catch (logErr) {
                    logger.error({
                      message: 'Failed to log conversion results',
                      orderId: order.id,
                      error: logErr,
                    });
                  }
                })
                .catch((err) => {
                  logger.error({
                    message: 'Offline conversion tracking failed',
                    orderId: order.id,
                    error: err,
                  });
                });

              logger.info({
                message: 'Offline conversion tracking initiated (Juicyway)',
                orderId: order.id,
              });
            }
          }
        } catch (conversionError) {
          logger.error({
            message: 'Failed to initiate offline conversion tracking',
            error: conversionError,
          });
        }
      }
    }

    // Record settlement for merchant wallet tracking
    try {
      const grossAmount = Number(transaction.amount) || 0;
      // Δ-0b: Juicyway verify response carries no fee; default to 0 honestly.
      const gatewayFee = 0;
      const platformFee =
        Number(transaction.platform_fee) || grossAmount * 0.015;

      // `record_merchant_settlement` is locked to service_role per the
      // 20260428071421 advisor cleanup. Webhook callbacks have no user
      // session (Juicyway calls us anonymously), so the SSR client runs
      // as `anon` and would hit a function-permission error. Trust
      // boundary is signature verification at the top of this handler.
      // (The IP allowlist is currently audit-only / logging — see line 64.)
      // Using the admin client here is safe.
      const adminSupabase = createAdminClient();
      const { error: settlementError } = await adminSupabase.rpc(
        'record_merchant_settlement',
        {
          p_merchant_id: transaction.merchant_id,
          p_source_type: 'order',
          p_source_id: transaction.order_id,
          p_gateway: 'juicyway',
          p_gateway_reference: reference,
          p_gross_amount: grossAmount,
          p_gateway_fee: gatewayFee,
          p_platform_fee: platformFee,
          p_description: 'Order payment via Juicyway',
          // Δ-29 / Δ-59: traceability — Juicyway's gateway-side ref lives
          // in metadata for downstream reconciliation queries.
          p_metadata: { juicyway_reference: reference },
        }
      );

      if (settlementError) {
        logger.warn({
          message: 'Failed to record merchant settlement',
          error: settlementError,
          reference,
        });
      } else {
        logger.info({
          message: 'Merchant settlement recorded (Juicyway)',
          reference,
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
      message: 'Juicyway payment processed successfully',
      reference,
      transactionId: transaction.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    logger.error({ message: 'Juicyway webhook error', error });
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
