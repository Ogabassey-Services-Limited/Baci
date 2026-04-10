import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
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

/**
 * Verify the request comes from Juicyway IPs (optional extra security)
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
        'id, order_id, merchant_id, amount, gateway_fee, platform_fee, status'
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

    // Check if already processed (idempotency)
    if (transaction.status === 'completed') {
      logger.info({ message: 'Transaction already processed', reference });
      return NextResponse.json({ message: 'Already processed' });
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
          message: 'Order updated successfully via Juicyway',
          orderId: transaction.order_id,
        });

        // Send order confirmation email
        try {
          const { data: merchantDetails } = await supabase
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
          const { data: merchantAnalytics } = await supabase
            .from('merchants')
            .select(`
              offline_conversions_enabled,
              facebook_pixel_id,
              facebook_capi_token,
              tiktok_pixel_id,
              tiktok_access_token,
              google_analytics_id,
              ga4_api_secret,
              snapchat_pixel_id,
              snapchat_capi_token
            `)
            .eq('id', transaction.merchant_id)
            .single();

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

            const hasAnalytics =
              (analyticsConfig.facebook_pixel_id &&
                analyticsConfig.facebook_capi_token) ||
              (analyticsConfig.tiktok_pixel_id &&
                analyticsConfig.tiktok_access_token) ||
              (analyticsConfig.google_analytics_id &&
                analyticsConfig.ga4_api_secret) ||
              (analyticsConfig.snapchat_pixel_id &&
                analyticsConfig.snapchat_capi_token);

            if (hasAnalytics) {
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
      const gatewayFee = Number(transaction.gateway_fee) || 0;
      const platformFee =
        Number(transaction.platform_fee) || grossAmount * 0.015;

      const { error: settlementError } = await supabase.rpc(
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
