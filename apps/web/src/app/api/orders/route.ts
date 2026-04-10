import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { formatVariantAttributesLabel } from '@/lib/format-variant-attributes-label';
import { detectPrivacyRegion } from '@/lib/geo-privacy';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { getClientIdentifier } from '@/lib/rate-limit';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';
import { orderCreateSchema } from '@/schemas/orders';

function isPayOnDelivery(paymentMethod: string): boolean {
  return paymentMethod === 'pod' || paymentMethod === 'pay_on_delivery';
}

/** Server-authoritative assurance rate — never trust the client value. */
const SERVER_ASSURANCE_RATE = 0.05;

type EmailOrderItem = {
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
};

// GET /api/orders - Fetch orders for authenticated merchant
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error({ message: 'API: Auth error or no user', error: authError });
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to fetch orders.' },
        { status: 401 }
      );
    }

    // Get merchant record (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      logger.error({
        message: 'API: Merchant not found for user',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Merchant not found for the authenticated user.' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'orders', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Get search params for filtering
    const { searchParams } = new URL(request.url);
    const paymentStatus = searchParams.get('payment_status');
    const shippingStatus = searchParams.get('shipping_status');
    const searchRaw = searchParams.get('search');

    // Sanitize search input
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;

    // Build query
    let query = supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_QUERY)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    if (shippingStatus && shippingStatus !== 'all') {
      query = query.eq('shipping_status', shippingStatus);
    }

    // Search by customer name or order number (with sanitized input)
    if (search?.trim()) {
      const sanitizedPattern = sanitizeLikePattern(search);
      query = query.or(
        `customer_name.ilike.%${sanitizedPattern}%,order_number.ilike.%${sanitizedPattern}%`
      );
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      logger.error({ message: 'Error fetching orders', error: ordersError });
      return NextResponse.json(
        { error: 'Failed to fetch orders from the database.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    logger.error({ message: 'Unexpected error in GET /api/orders', error });
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order from storefront
// CSRF exemption: This endpoint is called by unauthenticated storefront guests during checkout.
// Guest users do not have CSRF tokens. Abuse is mitigated by rate limiting in proxy.ts,
// Zod validates input shape, while the SECURITY DEFINER RPC enforces merchant + item authorization server-side.
export async function POST(request: NextRequest) {
  try {
    // Optional auth: supports web cookies and mobile Bearer tokens, but still
    // allows guest checkout when authentication is absent.
    const auth = await authenticateApiRequest(request);
    const supabase = auth.supabase ?? createClient(await cookies());
    const user = auth.user;
    const json = await request.json();

    // Capture IP and User Agent for enhanced ad tracking (improves Event Match Quality)
    // Use centralized IP resolution logic to prevent spoofing
    const clientIp = getClientIdentifier(request);
    const clientUserAgent = request.headers.get('user-agent') || undefined;

    // Detect privacy region for CCPA/GDPR compliance (LDU flag)
    const geoPrivacy = await detectPrivacyRegion(clientIp);

    const parseResult = orderCreateSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    const {
      merchant_id,
      customer_email,
      customer_name,
      customer_phone,
      items,
      shipping_fee, // Default already handled by Zod
      payment_method,
      payment_status,
      shipping_status,
      shipping_address,
      source,
      notes,
      // Ad tracking data for offline conversions
      ad_tracking,
      // Wallet redemption
      use_wallet_credit,
      wallet_amount,
      // User ID
      user_id,
    } = body;

    if (user && user_id && user_id !== user.id) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // SECURITY: Only use user_id from authenticated session.
    // Do NOT trust user_id from body if user is unauthenticated (guest).
    const resolvedUserId = user?.id || null;

    // Fetch merchant to verify it exists (include business_name, slug for email)
    const { data: merchant, error: merchantFetchError } = await supabase
      .from('merchants')
      .select(
        'id, rider_phone_number, business_name, business_address, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
      )
      .eq('id', merchant_id)
      .single();

    if (merchantFetchError || !merchant) {
      logger.error({
        message: 'Failed to fetch merchant for order creation',
        error: merchantFetchError,
      });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const orderItemsPayload = items.map((item) => {
      const hasAssurance = item.has_assurance || false;
      const itemPrice = item.negotiatedPrice ?? item.price;
      // SECURITY: Recompute assurance_fee server-side — never trust client values
      const assuranceFee = hasAssurance ? itemPrice * SERVER_ASSURANCE_RATE : 0;

      return {
        product_id: item.product_id || item.productId || item.id,
        condition: item.condition,
        variant_id: item.variantId || item.variant_id,
        variant_attributes:
          item.variantAttributes || item.variant_attributes || {},
        quantity: item.quantity,
        has_assurance: hasAssurance,
        assurance_fee: assuranceFee,
      };
    });

    if (orderItemsPayload.some((item) => !item.product_id)) {
      return NextResponse.json(
        { error: 'Invalid order items' },
        { status: 400 }
      );
    }

    const shippingFeeValue = Number.parseFloat(shipping_fee.toString());
    const discountAmountValue = Number.parseFloat(
      (body.discount_amount || 0).toString()
    );
    const taxAmountValue = Number.parseFloat((body.tax_amount || 0).toString());

    if (
      Number.isNaN(shippingFeeValue) ||
      Number.isNaN(discountAmountValue) ||
      Number.isNaN(taxAmountValue)
    ) {
      return NextResponse.json(
        { error: 'Invalid pricing values' },
        { status: 400 }
      );
    }

    const adTrackingPayload = ad_tracking
      ? {
          ...ad_tracking,
          userIp: clientIp || ad_tracking.userIp,
          userAgent: clientUserAgent || ad_tracking.userAgent,
          limitedDataUse:
            geoPrivacy.shouldApplyLDU || ad_tracking.limitedDataUse,
          geoCountry: geoPrivacy.country,
          geoRegion: geoPrivacy.region,
        }
      : clientIp || clientUserAgent || geoPrivacy.shouldApplyLDU
        ? {
            userIp: clientIp,
            userAgent: clientUserAgent,
            limitedDataUse: geoPrivacy.shouldApplyLDU,
            geoCountry: geoPrivacy.country,
            geoRegion: geoPrivacy.region,
          }
        : null;

    const resolvedShippingProvider = body.shipping_provider ?? null;
    const resolvedTrackingNumber = body.tracking_number ?? null;

    const payOnDelivery = isPayOnDelivery(payment_method);

    let effectivePaymentStatus = payment_status;
    if (payOnDelivery) {
      effectivePaymentStatus = 'pending';

      if (merchant?.rider_phone_number) {
        logger.info({
          message: 'Rider Notification Triggered (POD)',
          riderPhone: merchant.rider_phone_number,
          customerName: customer_name,
          customerAddress: shipping_address?.address,
        });
      } else {
        logger.warn({
          message: 'Rider Notification Skipped (No Phone Number)',
          merchantId: merchant_id,
        });
      }
    }

    const { data: orderRows, error: orderError } = await supabase.rpc(
      'create_storefront_order',
      {
        p_merchant_id: merchant_id,
        p_customer_email: customer_email,
        p_customer_name: customer_name,
        p_customer_phone: customer_phone || null,
        p_items: orderItemsPayload,
        p_shipping_fee: shippingFeeValue,
        p_discount_amount: discountAmountValue,
        p_tax_amount: taxAmountValue,
        p_payment_method: payment_method,
        p_payment_status: effectivePaymentStatus,
        p_shipping_status: shipping_status,
        p_shipping_address: shipping_address || null,
        p_source: source,
        p_notes: notes || null,
        p_ad_tracking: adTrackingPayload,
        p_selected_quote_id: body.selected_quote_id || null,
        p_shipping_provider: resolvedShippingProvider,
        p_tracking_number: resolvedTrackingNumber || null,
        p_user_id: resolvedUserId,
      }
    );

    const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;

    if (orderError || !order) {
      logger.error({ message: 'Error creating order', error: orderError });
      const message = orderError?.message || 'Failed to create order';
      const code =
        typeof orderError?.code === 'string' ? orderError.code : null;
      const clientErrorCodes = [
        'invalid_items',
        'invalid_quantity',
        'invalid_variant',
        'insufficient_stock',
        'merchant_not_found',
        'customer_email_required',
        'customer_name_required',
        'items_required',
        'user_id_mismatch',
        '22P02', // PostgreSQL: Invalid text representation (e.g. invalid UUID format)
      ];
      // create_storefront_order should return { message, code } for client errors.
      const isClientError = code
        ? clientErrorCodes.includes(code)
        : clientErrorCodes.includes(message);
      return NextResponse.json(
        { error: 'Failed to create order', details: message },
        { status: isClientError ? 400 : 500 }
      );
    }

    const orderTotal = Number(order.total ?? 0);
    const orderSubtotal = Number(order.subtotal ?? 0);
    const orderShippingFee = Number(order.shipping_fee ?? shippingFeeValue);
    const customer_id = order.customer_id || null;
    const orderNum = order.order_number || order.id.slice(0, 8).toUpperCase();

    // === WALLET REDEMPTION (2025 Best Practice: Auto-apply at checkout) ===
    // Process wallet credit redemption atomically after order creation
    let walletRedemptionResult: {
      success: boolean;
      amountRedeemed: number;
      newBalance: number;
      transactionId: string | null;
    } | null = null;

    if (use_wallet_credit && wallet_amount > 0 && customer_id) {
      try {
        // Call atomic wallet redemption function (handles idempotency via order_id)
        const { data: redemptionData, error: redemptionError } =
          await supabase.rpc('redeem_wallet_for_order', {
            p_customer_id: customer_id,
            p_merchant_id: merchant_id,
            p_order_id: order.id,
            p_amount: Math.min(wallet_amount, orderTotal), // Can't redeem more than order total
            p_order_reference: order.order_number || order.id,
          });

        if (redemptionError) {
          // Log but don't fail order - wallet redemption is optional
          logger.error({
            message: 'Wallet redemption failed',
            error: redemptionError,
            orderId: order.id,
            customerId: customer_id,
            requestedAmount: wallet_amount,
          });
        } else if (redemptionData?.[0]) {
          const result = redemptionData[0];
          if (result.success) {
            walletRedemptionResult = {
              success: true,
              amountRedeemed: Number(result.redeemed_amount),
              newBalance: Number(result.new_balance),
              transactionId: result.transaction_id,
            };

            logger.info({
              message: 'Wallet redemption successful',
              orderId: order.id,
              customerId: customer_id,
              amountRedeemed: result.redeemed_amount,
              newBalance: result.new_balance,
            });
          } else {
            logger.warn({
              message: 'Wallet redemption returned unsuccessful',
              orderId: order.id,
              customerId: customer_id,
              result,
            });
          }
        }
      } catch (walletError) {
        logger.error({
          message: 'Wallet redemption exception',
          error: walletError,
          orderId: order.id,
        });
      }
    }

    // Calculate amount due to payment gateway (total - wallet credit used)
    const walletAmountUsed = walletRedemptionResult?.amountRedeemed || 0;
    const amountDueToGateway = orderTotal - walletAmountUsed;
    let walletFinalized = false;

    // If wallet fully covers the order, mark as paid immediately (2025 best practice)
    if (walletAmountUsed > 0 && amountDueToGateway <= 0) {
      const { error: walletFinalizeError } = await supabase.rpc(
        'finalize_wallet_order_payment',
        {
          p_order_id: order.id,
          p_amount: walletAmountUsed,
        }
      );

      if (walletFinalizeError) {
        logger.error({
          message: 'Failed to finalize wallet payment',
          error: walletFinalizeError,
          orderId: order.id,
        });
      } else {
        walletFinalized = true;
        logger.info({
          message: 'Order fully paid with wallet credit',
          orderId: order.id,
          walletAmountUsed,
        });
      }
    }

    // NOTE: Order confirmation email is NOT sent here at order creation.
    // It is sent ONLY after payment is confirmed via webhook handlers:
    // - /api/payments/webhook/route.ts (for Paystack/Korapay)
    // - /api/payments/juicyway/webhook/route.ts (for Juicyway)
    // This prevents sending confirmation emails for abandoned/unpaid orders.
    //
    // Exceptions (send immediately):
    // - POD (Pay on Delivery) or Invoice: no payment gateway redirect
    // - Wallet-paid orders: payment already confirmed via wallet redemption
    const isWalletFullyPaid = walletFinalized;
    if (payOnDelivery || payment_method === 'invoice' || isWalletFullyPaid) {
      try {
        if (merchant.business_name && merchant.slug) {
          const rootDomain =
            process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
          const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

          // Format items for email template
          const emailItems = items.map((item: EmailOrderItem) => ({
            name: (() => {
              const baseName = item.name || item.productName || 'Product';
              const variantLabel = formatVariantAttributesLabel(
                (
                  item as EmailOrderItem & {
                    variantAttributes?: Record<string, string>;
                    variant_attributes?: Record<string, string>;
                  }
                ).variantAttributes ||
                  (
                    item as EmailOrderItem & {
                      variantAttributes?: Record<string, string>;
                      variant_attributes?: Record<string, string>;
                    }
                  ).variant_attributes
              );

              return variantLabel ? `${baseName} (${variantLabel})` : baseName;
            })(),
            quantity: item.quantity || 1,
            price: item.price || 0,
          }));

          // Generate email content
          const emailData = {
            orderNumber: orderNum,
            customerName: customer_name,
            items: emailItems,
            subtotal: orderSubtotal,
            shippingFee: orderShippingFee,
            total: orderTotal,
            shippingAddress: {
              address: shipping_address?.address || '',
              city: shipping_address?.city || '',
              state: shipping_address?.state || '',
              phone: customer_phone || '',
            },
            merchantName: merchant.business_name,
            merchantUrl,
            merchantTin: merchant.tax_identification_number ?? undefined,
            merchantRcNumber: merchant.cac_rc_number ?? undefined,
          };

          const htmlContent = generateOrderConfirmationEmail(emailData);
          const textContent = generateOrderConfirmationText(emailData);

          // Send and verify the result before returning so POD/invoice/wallet-paid
          // orders do not lose confirmation emails when the request lifecycle ends.
          // Use merchant's support_email as reply-to (so customer replies go to merchant)
          // Use merchant's email_sender_name for branding (e.g., "Ogabassey Orders" instead of "Baci Orders")
          const replyToEmail =
            merchant.support_email ||
            merchant.email ||
            `support@${merchant.slug}.${rootDomain}`;
          const senderName = merchant.email_sender_name
            ? `${merchant.email_sender_name} Orders`
            : merchant.business_name
              ? `${merchant.business_name} Orders`
              : undefined;

          const emailResult = await sendEmail({
            to: customer_email,
            toName: customer_name,
            subject: `Order Confirmation - #${emailData.orderNumber}`,
            htmlContent,
            textContent,
            replyTo: replyToEmail,
            emailType: 'orders',
            fromName: senderName,
            auditContext: {
              merchantId: merchant_id,
              orderId: order.id,
              customerId: customer_id,
              metadata: {
                trigger: 'order_create_immediate_confirmation',
                paymentMethod: payment_method,
              },
            },
          });

          if (!emailResult.success) {
            logger.error({
              message: 'Failed to send order confirmation email',
              orderId: order.id,
              paymentMethod: payment_method,
              emailError: emailResult.error,
              emailErrorCode: emailResult.errorCode,
              emailErrorDetails: emailResult.errorDetails,
            });
          } else {
            logger.info({
              message: 'Order confirmation email sent',
              orderId: order.id,
              paymentMethod: payment_method,
              messageId: emailResult.messageId,
            });
          }
        }
      } catch (emailError) {
        // Don't fail the order creation if email fails
        logger.error({
          message: 'Error preparing order confirmation email',
          error: emailError,
        });
      }
    }

    // Notify merchant of new order — only for POD/invoice/wallet-paid orders.
    // Gateway-payment orders (Paystack, Korapay, etc.) are notified via their webhook handlers
    // to avoid duplicate notifications.
    if (payOnDelivery || payment_method === 'invoice' || isWalletFullyPaid) {
      try {
        const pushResult = await notifyNewOrder(
          merchant_id,
          order.id,
          orderNum,
          customer_name,
          orderTotal
        );
        if (pushResult.failed > 0 || pushResult.errors.length > 0) {
          logger.warn({
            message: 'New order push notification was not fully delivered',
            orderId: order.id,
            merchantId: merchant_id,
            sent: pushResult.sent,
            failed: pushResult.failed,
            errors: pushResult.errors,
          });
        }
      } catch (err) {
        logger.error({ message: 'Push notification failed', error: err });
      }

      if (isWalletFullyPaid) {
        try {
          const paymentPushResult = await notifyPaymentReceived(
            merchant_id,
            orderTotal,
            order.currency || 'NGN',
            orderNum,
            order.id
          );
          if (
            paymentPushResult.failed > 0 ||
            paymentPushResult.errors.length > 0
          ) {
            logger.warn({
              message: 'Payment push notification was not fully delivered',
              orderId: order.id,
              merchantId: merchant_id,
              sent: paymentPushResult.sent,
              failed: paymentPushResult.failed,
              errors: paymentPushResult.errors,
            });
          }
        } catch (err) {
          logger.error({
            message: 'Payment push notification failed',
            error: err,
          });
        }
      }
    }

    const responseOrder = isWalletFullyPaid
      ? { ...order, payment_status: 'paid', payment_method: 'wallet' }
      : order;

    // Return order with wallet info for checkout UI
    return NextResponse.json(
      {
        order: responseOrder,
        // Wallet redemption details for UI display
        wallet: walletRedemptionResult
          ? {
              amountUsed: walletRedemptionResult.amountRedeemed,
              newBalance: walletRedemptionResult.newBalance,
              transactionId: walletRedemptionResult.transactionId,
            }
          : null,
        // Amount still due to payment gateway (for payment initialization)
        amountDueToGateway,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ message: 'Unexpected error in POST /api/orders', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
