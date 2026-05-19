import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { markAgenticPaystackDvaSessionPaid } from '@/lib/agentic/paystack-dva-session-paid';
import {
  AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT,
  type AgenticPaystackDvaTransaction,
  normalizeAgenticPaystackDvaTransaction,
} from '@/lib/agentic/paystack-dva-transaction';
import {
  confirmAgenticPaystackDvaPayment,
  getPaystackDvaReceiverAccountNumber,
} from '@/lib/agentic/paystack-dva-webhook';
import { upsertPaystackAuthorization } from '@/lib/customer-saved-payment-methods';
import {
  creditWalletTopUp,
  WALLET_TOP_UP_TRANSACTION_TYPE,
} from '@/lib/customer-wallet-top-up';
import { triggerDomainEdgeConfigSync } from '@/lib/edge-config-sync';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { formatVariantAttributesLabel } from '@/lib/format-variant-attributes-label';
import { registerDomain } from '@/lib/go54';
import { verifyPayment as verifyKorapayPayment } from '@/lib/korapay';
import { logger } from '@/lib/logger';
import {
  applyPaidOrderSideEffects,
  type StepExecutor,
} from '@/lib/payments/apply-paid-order-side-effects';
import { confirmPaystackDvaByOrderAccount } from '@/lib/payments/confirm-paystack-dva-by-order-account';
import { extractVerifiedGatewayFeeNgn } from '@/lib/payments/verified-gateway-fee';
import {
  calculatePlatformFee,
  verifyTransaction as verifyPaystackPayment,
} from '@/lib/paystack';
import { isValidUuid, sanitizeForLog } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { triggerPurchaseConversion } from '@/lib/trigger-purchase-conversion';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';
import { sendEmail } from '@/lib/zeptomail';
import { referenceSchema } from '@/schemas/payments';

type PaymentGateway = 'paystack' | 'korapay';

interface PaymentTransactionRecord {
  amount: number | string | null;
  id: string;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
}

async function reconcileAgenticPaystackDvaSession({
  metadata,
  reference,
  supabase,
  transaction,
}: {
  metadata: Record<string, unknown> | null;
  reference: string;
  supabase: SupabaseClient;
  transaction: { merchant_id: string; order_id?: string | null };
}) {
  const agenticSessionPayment = await markAgenticPaystackDvaSessionPaid({
    gatewayReference: reference,
    supabase,
    transaction: {
      merchant_id: transaction.merchant_id,
      metadata,
      order_id: transaction.order_id ?? null,
    },
  });
  if (agenticSessionPayment.ok) {
    return null;
  }

  logger.error({
    message: 'Agentic checkout session reconciliation failed',
    reference,
    error: sanitizeForLog(agenticSessionPayment.error),
  });
  return NextResponse.json(
    { error: 'Agentic checkout session reconciliation failed' },
    { status: 500 }
  );
}

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

function getVerifiedAmount(
  gateway: PaymentGateway,
  gatewayResponse: Record<string, unknown>
): { amount: number; currency?: string } | null {
  const rawAmount = gatewayResponse.amount;
  if (
    typeof rawAmount !== 'number' ||
    !Number.isFinite(rawAmount) ||
    rawAmount <= 0
  ) {
    return null;
  }

  const currency =
    typeof gatewayResponse.currency === 'string'
      ? gatewayResponse.currency
      : undefined;
  const amount = gateway === 'paystack' ? rawAmount / 100 : rawAmount;

  return { amount, currency };
}

async function handleWalletTopUpIfNeeded({
  gateway,
  reference,
  supabase,
  transaction,
}: {
  gateway: PaymentGateway;
  reference: string;
  supabase: SupabaseClient;
  transaction: PaymentTransactionRecord;
}) {
  const metadata = transaction.metadata ?? {};
  if (metadata.transaction_type !== WALLET_TOP_UP_TRANSACTION_TYPE) {
    return null;
  }

  if (typeof metadata.customer_id !== 'string') {
    logger.error({
      message: 'Wallet top-up metadata missing customer id',
      reference,
      transactionId: transaction.id,
    });
    return NextResponse.json(
      { error: 'Wallet top-up customer not found' },
      { status: 400 }
    );
  }

  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    logger.error({
      message: 'Wallet top-up transaction has invalid amount',
      amount: transaction.amount,
      reference,
      transactionId: transaction.id,
    });
    return NextResponse.json(
      { error: 'Invalid wallet top-up amount' },
      { status: 400 }
    );
  }

  let walletCredit: Awaited<ReturnType<typeof creditWalletTopUp>>;
  try {
    walletCredit = await creditWalletTopUp({
      amount,
      customerId: metadata.customer_id,
      gateway,
      merchantId: transaction.merchant_id,
      reference,
      supabase,
      transactionId: transaction.id,
    });
  } catch (error) {
    logger.error({
      message: 'Wallet top-up credit failed',
      customerId: metadata.customer_id,
      error,
      gateway,
      reference,
      transactionId: transaction.id,
    });
    return NextResponse.json(
      { error: 'Failed to credit wallet top-up' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: 'Wallet top-up credited',
    reference: walletCredit.reference,
    wallet: {
      balance: walletCredit.balance,
    },
  });
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
    const signatureHex = String(signature).toLowerCase();
    let expectedKorapaySignature: string | null = null;

    // Korapay currently signs ONLY the `data` object with HMAC-SHA256.
    // Keep a legacy fallback for existing integrations that may still sign
    // the full payload with SHA512.
    try {
      const parsedPayload = JSON.parse(payload) as {
        data?: Record<string, unknown>;
      };
      const dataPayload = parsedPayload.data;

      expectedKorapaySignature =
        dataPayload && typeof dataPayload === 'object'
          ? createHmac('sha256', secretKey)
              .update(JSON.stringify(dataPayload))
              .digest('hex')
          : null;
    } catch {
      expectedKorapaySignature = null;
    }

    if (
      expectedKorapaySignature &&
      verifyWebhookSignature(signatureHex, expectedKorapaySignature)
    ) {
      return true;
    }

    const legacySignature = createHmac('sha512', secretKey)
      .update(payload)
      .digest('hex');

    const isLegacyMatch = verifyWebhookSignature(signatureHex, legacySignature);
    if (isLegacyMatch) {
      logger.warn({
        message:
          'Korapay webhook matched legacy SHA512 payload signature. Please use SHA256 over payload.data.',
      });
    }

    return isLegacyMatch;
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
    return verifyWebhookSignature(
      String(signature).toLowerCase(),
      expectedSignature
    );
  } catch (error) {
    logger.error({
      message: 'Paystack webhook signature verification error',
      error,
    });
    return false;
  }
}

function verifyWebhookSignature(
  providedSignature: string,
  expectedSignature: string
): boolean {
  try {
    const signatureBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
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
        status?: string;
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
      // Korapay webhook structure can place the reference either at the top
      // level or nested in data.reference, depending on event type/version.
      reference = body.reference ?? body.data?.reference ?? '';
      const event = body.event;
      const status = body.status ?? body.data?.status;

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
    const referenceResult = referenceSchema.safeParse(reference);

    if (!referenceResult.success) {
      return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
    }
    const safeReference = referenceResult.data;
    reference = safeReference;

    // Webhook handlers have no user cookies — use service client to bypass RLS
    const supabase = createServiceClient();

    // Verify payment with the appropriate gateway
    let paymentStatus: string;
    let gatewayResponse: Record<string, unknown>;

    if (gateway === 'paystack') {
      const result = await verifyPaystackPayment(safeReference);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      paymentStatus = result.data.status;
      gatewayResponse = result.data as unknown as Record<string, unknown>;
    } else {
      const result = await verifyKorapayPayment(safeReference);
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

    const verifiedAmount = getVerifiedAmount(gateway, gatewayResponse);

    if (
      (gateway === 'paystack' || gateway === 'korapay') &&
      verifiedAmount === null
    ) {
      logger.error({
        gateway,
        message: 'Payment webhook missing verified amount',
        reference,
      });
      return NextResponse.json(
        { error: 'Payment amount verification failed' },
        { status: 422 }
      );
    }

    let resolvedAgenticTransaction: AgenticPaystackDvaTransaction | null = null;
    if (gateway === 'paystack') {
      const receiverAccountNumber = getPaystackDvaReceiverAccountNumber(body);

      const agenticDvaPayment = await confirmAgenticPaystackDvaPayment({
        accountNumber: receiverAccountNumber,
        gatewayReference: reference,
        supabase,
        verifiedAmount,
      });

      if (agenticDvaPayment.handled) {
        return NextResponse.json(agenticDvaPayment.body, {
          status: agenticDvaPayment.status,
        });
      }
      resolvedAgenticTransaction = agenticDvaPayment.transaction ?? null;

      // B1 (Δ-3, Δ-6, Δ-10, Δ-55, Δ-57): if the agentic checkout-session
      // path didn't match, try the regular DVA path — match against the
      // persisted `order_payment_accounts` row(s) using B0's 6-key
      // tighten. On single match, insert a pending `transactions` row
      // so the webhook's normal flow flips it to completed and runs
      // side effects via the A1 outbox. Ambiguous matches file a
      // `reconciliation_review` row and return 409.
      if (!resolvedAgenticTransaction) {
        const orderAccountResult = await confirmPaystackDvaByOrderAccount({
          supabase,
          accountNumber: receiverAccountNumber,
          gatewayReference: reference,
          verifiedAmount,
          paystackResponse: gatewayResponse,
        });
        if (orderAccountResult.kind === 'review') {
          return NextResponse.json(orderAccountResult.body, {
            status: orderAccountResult.status,
          });
        }
        if (orderAccountResult.kind === 'match') {
          resolvedAgenticTransaction =
            orderAccountResult.transaction as AgenticPaystackDvaTransaction;
        }
      }
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
        .select(
          'id, merchant_id, customer_id, customer_name, customer_email, customer_phone, shipping_address, session_id, subtotal, shipping_fee, items'
        )
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
        if (verifiedAmount) {
          const chatTotal =
            (Number(chatOrder.subtotal) || 0) +
            (Number(chatOrder.shipping_fee) || 0);
          if (Math.abs(verifiedAmount.amount - chatTotal) > 0.01) {
            logger.error({
              message: 'Payment amount mismatch for chat order',
              reference,
              gateway,
              expected: chatTotal,
              received: verifiedAmount.amount,
              currency: verifiedAmount.currency,
            });
            return NextResponse.json(
              { error: 'Payment amount mismatch' },
              { status: 400 }
            );
          }

          if (
            verifiedAmount.currency &&
            verifiedAmount.currency.toUpperCase() !== 'NGN'
          ) {
            logger.error({
              message: 'Payment currency mismatch for chat order',
              reference,
              gateway,
              expected: 'NGN',
              received: verifiedAmount.currency,
            });
            return NextResponse.json(
              { error: 'Payment currency mismatch' },
              { status: 400 }
            );
          }
        } else {
          logger.warn({
            message: 'Could not verify payment amount for chat order',
            reference,
            gateway,
          });
        }

        const claimTimestamp = new Date().toISOString();
        const { data: claimedChatOrder, error: claimError } = await supabase
          .from('chat_orders')
          .update({
            status: 'processing',
            updated_at: claimTimestamp,
          })
          .eq('id', chatOrder.id)
          .eq('status', 'pending_payment')
          .select('id')
          .maybeSingle();

        if (claimError) {
          logger.error({
            message: 'Failed to claim chat order for conversion',
            reference,
            chatOrderId: chatOrder.id,
            error: claimError,
          });
          return NextResponse.json(
            { error: 'Failed to claim chat order' },
            { status: 500 }
          );
        }

        if (!claimedChatOrder) {
          logger.info({
            message: 'Chat order already claimed or processed',
            reference,
            chatOrderId: chatOrder.id,
          });
          return NextResponse.json({ message: 'Already processed' });
        }

        // Parse items from JSONB
        const chatItems = (chatOrder.items || []) as Array<{
          product_id: string;
          variant_id?: string;
          name: string;
          quantity: number;
          price: number;
          image_url?: string;
        }>;

        const variantIds = [
          ...new Set(
            chatItems
              .map((item) => item.variant_id)
              .filter(
                (variantId): variantId is string =>
                  !!variantId && isValidUuid(variantId)
              )
          ),
        ];
        const variantNameMap = new Map<string, string>();

        if (variantIds.length > 0) {
          const { data: variants, error: variantsError } = await supabase
            .from('product_variants')
            .select('id, attributes')
            .in('id', variantIds);

          if (variantsError) {
            logger.error({
              message: 'Failed to load variant labels for chat order items',
              reference,
              error: variantsError,
            });
          } else {
            for (const variant of variants || []) {
              const variantLabel = formatVariantAttributesLabel(
                variant.attributes
              );

              if (variantLabel) {
                variantNameMap.set(variant.id, variantLabel);
              }
            }
          }
        }

        // Create standard order from chat order.
        // Let the database generate the canonical order number and tracking token.
        const { data: newOrder, error: orderCreateError } = await supabase
          .from('orders')
          .insert({
            merchant_id: chatOrder.merchant_id,
            customer_id: chatOrder.customer_id || null,
            customer_name: chatOrder.customer_name,
            customer_email: chatOrder.customer_email,
            customer_phone: chatOrder.customer_phone,
            shipping_address: chatOrder.shipping_address,
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
          .select('id, order_number')
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

        const orderNumber = newOrder.order_number;

        if (!orderNumber) {
          logger.error({
            message: 'Canonical order number missing for chat order conversion',
            reference,
            chatOrderId: chatOrder.id,
            orderId: newOrder.id,
          });
          return NextResponse.json(
            { error: 'Failed to create canonical order number' },
            { status: 500 }
          );
        }

        // Create order items
        const orderItems = chatItems.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          variant_name: item.variant_id
            ? (variantNameMap.get(item.variant_id) ?? null)
            : null,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          line_extension_amount: item.quantity * item.price,
          item_description: item.name,
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
          amount: (
            Number(chatOrder.subtotal) + Number(chatOrder.shipping_fee || 0)
          ).toString(),
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
        const { error: chatOrderUpdateError } = await supabase
          .from('chat_orders')
          .update({
            status: 'paid',
            order_id: newOrder.id,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', chatOrder.id)
          .eq('status', 'processing');

        if (chatOrderUpdateError) {
          logger.warn({
            message: 'Failed to finalize chat order status after conversion',
            reference,
            chatOrderId: chatOrder.id,
            orderId: newOrder.id,
            error: chatOrderUpdateError,
          });
        }

        // Send push notification to merchant (non-blocking)
        after(async () => {
          const orderAmount =
            (Number(chatOrder.subtotal) || 0) +
            (Number(chatOrder.shipping_fee) || 0);

          try {
            await notifyNewOrder(
              chatOrder.merchant_id,
              newOrder.id,
              orderNumber,
              chatOrder.customer_name || 'Customer',
              orderAmount,
              'NGN'
            );
          } catch (pushErr) {
            logger.warn({
              message: 'New order push notification failed for chat order',
              error: pushErr,
            });
          }

          try {
            await notifyPaymentReceived(
              chatOrder.merchant_id,
              orderAmount,
              'NGN',
              orderNumber,
              newOrder.id
            );
          } catch (pushErr) {
            logger.warn({
              message:
                'Payment received push notification failed for chat order',
              error: pushErr,
            });
          }
        });

        // Send order confirmation email
        try {
          const { data: merchantDetails } = await supabase
            .from('merchants')
            .select(
              'business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
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
              merchantTin:
                merchantDetails.tax_identification_number ?? undefined,
              merchantRcNumber: merchantDetails.cac_rc_number ?? undefined,
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
              auditContext: {
                merchantId: chatOrder.merchant_id,
                orderId: newOrder.id,
                customerId: chatOrder.customer_id || null,
                metadata: {
                  trigger: 'paystack_chat_order_confirmation',
                  chatOrderId: chatOrder.id,
                },
              },
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
            // Δ-29 / Δ-59: traceability — gateway-side ref lives in metadata
            // only (chat-order path has no separate BAC-* yet). Review
            // feedback: key is gateway-prefixed, not hardcoded paystack.
            p_metadata: { [`${gateway}_reference`]: reference },
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

    let transaction: AgenticPaystackDvaTransaction | null =
      resolvedAgenticTransaction;
    let transactionError: unknown = null;

    if (!transaction) {
      const transactionResult = await supabase
        .from('transactions')
        .select(AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT)
        .eq('gateway_reference', reference)
        .single();
      transaction = transactionResult.data
        ? normalizeAgenticPaystackDvaTransaction(transactionResult.data)
        : null;
      transactionError = transactionResult.error;
    }

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

    const metadata = transaction.metadata as Record<string, unknown>;

    if (verifiedAmount) {
      const transactionAmount = Number(transaction.amount) || 0;
      const expectedCurrency =
        typeof transaction.currency === 'string' ? transaction.currency : null;

      if (Math.abs(verifiedAmount.amount - transactionAmount) > 0.01) {
        logger.error({
          message: 'Payment amount mismatch',
          reference,
          gateway,
          expected: transactionAmount,
          received: verifiedAmount.amount,
          currency: verifiedAmount.currency,
        });
        return NextResponse.json(
          { error: 'Payment amount mismatch' },
          { status: 400 }
        );
      }

      if (
        expectedCurrency &&
        verifiedAmount.currency &&
        expectedCurrency.toUpperCase() !== verifiedAmount.currency.toUpperCase()
      ) {
        logger.error({
          message: 'Payment currency mismatch',
          reference,
          gateway,
          expected: expectedCurrency,
          received: verifiedAmount.currency,
        });
        return NextResponse.json(
          { error: 'Payment currency mismatch' },
          { status: 400 }
        );
      }
    } else {
      logger.warn({
        message: 'Could not verify payment amount',
        reference,
        gateway,
      });
    }

    // Atomically claim the transaction — prevents double-processing on concurrent retries
    const { data: updatedTxn, error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_response: gatewayResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id)
      .neq('status', 'completed')
      .select('id')
      .maybeSingle();

    if (updateError) {
      logger.error({
        message: 'Failed to update transaction',
        reference,
        error: updateError,
      });
      throw updateError;
    }

    if (!updatedTxn) {
      const walletTopUpResponse = await handleWalletTopUpIfNeeded({
        gateway,
        reference,
        supabase,
        transaction: {
          amount: transaction.amount,
          id: transaction.id,
          merchant_id: transaction.merchant_id,
          metadata,
        },
      });

      if (walletTopUpResponse) {
        return walletTopUpResponse;
      }

      if (
        metadata?.transaction_type === 'vtu_purchase' &&
        typeof metadata.vtu_transaction_id === 'string'
      ) {
        const fulfillment = await fulfillPendingVtuTransaction({
          supabase,
          transactionId: metadata.vtu_transaction_id,
        });

        return NextResponse.json({
          message:
            fulfillment.status === 'successful'
              ? 'VTU fulfillment already completed'
              : 'VTU fulfillment already in progress',
        });
      }

      logger.info({ message: 'Transaction already processed', reference });
      if (gateway === 'paystack') {
        const reconciliationFailure = await reconcileAgenticPaystackDvaSession({
          metadata,
          reference,
          supabase,
          transaction: {
            merchant_id: transaction.merchant_id,
            order_id: transaction.order_id,
          },
        });
        if (reconciliationFailure) {
          return reconciliationFailure;
        }
      }
      return NextResponse.json({ message: 'Already processed' });
    }

    const walletTopUpResponse = await handleWalletTopUpIfNeeded({
      gateway,
      reference,
      supabase,
      transaction: {
        amount: transaction.amount,
        id: transaction.id,
        merchant_id: transaction.merchant_id,
        metadata,
      },
    });

    if (walletTopUpResponse) {
      return walletTopUpResponse;
    }

    if (
      gateway === 'paystack' &&
      typeof metadata?.customer_id === 'string' &&
      typeof metadata?.customer_email === 'string' &&
      typeof gatewayResponse.authorization === 'object' &&
      gatewayResponse.authorization
    ) {
      try {
        await upsertPaystackAuthorization({
          supabase,
          merchantId: transaction.merchant_id,
          customerId: metadata.customer_id,
          customerEmail: metadata.customer_email,
          authorization: gatewayResponse.authorization as Parameters<
            typeof upsertPaystackAuthorization
          >[0]['authorization'],
        });
      } catch (authorizationError) {
        logger.warn({
          message: 'Failed to persist reusable Paystack authorization',
          error:
            authorizationError instanceof Error
              ? authorizationError.message
              : String(authorizationError),
          reference,
        });
      }
    }

    if (
      metadata?.transaction_type === 'vtu_purchase' &&
      typeof metadata.vtu_transaction_id === 'string'
    ) {
      const fulfillment = await fulfillPendingVtuTransaction({
        supabase,
        transactionId: metadata.vtu_transaction_id,
      });

      if (fulfillment.status !== 'successful') {
        console.error('VTU fulfillment failed after payment', {
          transactionId: metadata.vtu_transaction_id,
          status: fulfillment.status,
          reference: fulfillment.reference,
        });
      }

      return NextResponse.json({
        message:
          fulfillment.status === 'successful'
            ? 'VTU payment fulfilled'
            : 'VTU fulfillment failed — requires manual review',
      });
    }

    // ============================================
    // DOMAIN PURCHASE FULFILLMENT
    // ============================================
    // Check metadata for valid domain purchase
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
          .select(
            'business_name, email, address, city, state, phone, users:user_id(first_name, last_name)'
          )
          .eq('id', transaction.merchant_id)
          .single();

        if (!merchantData) {
          logger.error({
            message: 'Merchant not found for domain registration',
            merchantId: transaction.merchant_id,
          });
        } else {
          const merchantUser = Array.isArray(merchantData.users)
            ? merchantData.users[0]
            : merchantData.users;

          // 2. Prepare Contact Info (Fallbacks used for missing fields to ensure registration works)
          // Import dynamically or ensure imported at top - adding simple object here
          const contactName =
            merchantUser?.first_name ||
            merchantData.business_name ||
            'Baci User';
          const contactLastName = merchantUser?.last_name || 'Merchant';

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

          const normalizedDomain = metadata.domain.toLowerCase();
          const purchaseYears = Number(metadata.years) || 1;
          const tld =
            typeof metadata.tld === 'string' && metadata.tld.startsWith('.')
              ? metadata.tld
              : (() => {
                  const multipartTlds = [
                    '.com.ng',
                    '.org.ng',
                    '.net.ng',
                    '.edu.ng',
                    '.name.ng',
                  ];
                  const matchedMultipartTld = multipartTlds.find((candidate) =>
                    normalizedDomain.endsWith(candidate)
                  );

                  if (matchedMultipartTld) {
                    return `.${normalizedDomain.split('.').slice(-2).join('.')}`;
                  }

                  return `.${normalizedDomain.split('.').slice(-1)[0]}`;
                })();

          const markTransactionDomainPurchased = async (domainId?: string) => {
            const updatedMetadata: Record<string, unknown> = {
              ...metadata,
              domain_purchased: normalizedDomain,
              purchased_at: new Date().toISOString(),
            };

            if (domainId) {
              updatedMetadata.domain_id = domainId;
            }

            const { error: transactionMetadataError } = await supabase
              .from('transactions')
              .update({ metadata: updatedMetadata })
              .eq('id', transaction.id);

            if (transactionMetadataError) {
              logger.error({
                message: 'Failed to mark transaction as domain_purchased',
                error: transactionMetadataError,
                transactionId: transaction.id,
                domain: normalizedDomain,
              });
            }
          };

          // 3. Register Domain via Go54
          const registration = await registerDomain({
            domain: normalizedDomain,
            regperiod: purchaseYears,
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

            // 4. Persist to domains table (used by proxy + storefront resolution)
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + purchaseYears);
            const nowIso = new Date().toISOString();

            const { data: existingDomain, error: existingDomainError } =
              await supabase
                .from('domains')
                .select('id, merchant_id')
                .eq('domain', normalizedDomain)
                .maybeSingle();
            const domainPurchaseAmount = Number(transaction.amount) || 0;

            if (existingDomainError) {
              logger.error({
                message: 'Failed checking existing domain record',
                error: existingDomainError,
              });
            } else if (existingDomain) {
              if (existingDomain.merchant_id !== transaction.merchant_id) {
                logger.error({
                  message:
                    'Domain already belongs to a different merchant, skipping update',
                  domain: normalizedDomain,
                });
              } else {
                const { error: updateDomainError } = await supabase
                  .from('domains')
                  .update({
                    status: 'active',
                    ssl_status: 'active',
                    verified_at: nowIso,
                    expires_at: expiresAt.toISOString(),
                    auto_renew: true,
                    go54_order_id: registration.orderId || null,
                    purchase_price: domainPurchaseAmount,
                    renewal_price: domainPurchaseAmount,
                    nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
                  })
                  .eq('id', existingDomain.id);

                if (updateDomainError) {
                  logger.error({
                    message: 'Failed to update existing domain record',
                    error: updateDomainError,
                    domain: normalizedDomain,
                  });
                } else {
                  await markTransactionDomainPurchased(existingDomain.id);
                  after(() => triggerDomainEdgeConfigSync());
                }
              }
            } else {
              const { data: existingPrimaryDomain, error: primaryDomainError } =
                await supabase
                  .from('domains')
                  .select('id')
                  .eq('merchant_id', transaction.merchant_id)
                  .in('domain_type', ['custom', 'purchased'])
                  .eq('status', 'active')
                  .eq('is_primary', true)
                  .limit(1)
                  .maybeSingle();

              if (primaryDomainError) {
                logger.error({
                  message: 'Failed checking existing primary domain',
                  error: primaryDomainError,
                });
              }

              const shouldSetPrimary =
                !primaryDomainError && !existingPrimaryDomain;

              const { data: insertedDomain, error: domainDbError } =
                await supabase
                  .from('domains')
                  .insert({
                    merchant_id: transaction.merchant_id,
                    domain: normalizedDomain,
                    tld,
                    domain_type: 'purchased',
                    status: 'active',
                    is_primary: shouldSetPrimary,
                    verified_at: nowIso,
                    ssl_status: 'active',
                    go54_order_id: registration.orderId || null,
                    purchase_price: domainPurchaseAmount,
                    renewal_price: domainPurchaseAmount,
                    registered_at: nowIso,
                    expires_at: expiresAt.toISOString(),
                    auto_renew: true,
                    nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
                  })
                  .select('id')
                  .single();

              if (domainDbError) {
                logger.error({
                  message: 'Failed to save domain record',
                  error: domainDbError,
                  domain: normalizedDomain,
                });
              } else {
                await markTransactionDomainPurchased(insertedDomain?.id);
                after(() => triggerDomainEdgeConfigSync());
              }
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
        const fallbackDomain =
          typeof metadata.domain === 'string'
            ? metadata.domain.toLowerCase()
            : null;

        logger.error({
          message: 'Domain fulfillment failed',
          reference,
          transactionId: transaction.id,
          merchantId: transaction.merchant_id,
          domain: fallbackDomain,
          error: err,
        });

        if (fallbackDomain) {
          const fallbackTld = fallbackDomain.endsWith('.com.ng')
            ? '.com.ng'
            : fallbackDomain.endsWith('.org.ng')
              ? '.org.ng'
              : fallbackDomain.endsWith('.net.ng')
                ? '.net.ng'
                : fallbackDomain.endsWith('.edu.ng')
                  ? '.edu.ng'
                  : fallbackDomain.endsWith('.name.ng')
                    ? '.name.ng'
                    : `.${fallbackDomain.split('.').slice(-1)[0]}`;
          const nowIso = new Date().toISOString();

          try {
            const { data: existingDomain, error: existingDomainError } =
              await supabase
                .from('domains')
                .select('id, merchant_id')
                .eq('domain', fallbackDomain)
                .maybeSingle();

            if (existingDomainError) {
              logger.error({
                message: 'Failed checking fallback domain persistence state',
                domain: fallbackDomain,
                merchantId: transaction.merchant_id,
                reference,
                error: existingDomainError,
              });
            } else if (!existingDomain) {
              const domainPurchaseAmount = Number(transaction.amount) || 0;
              const { error: fallbackInsertError } = await supabase
                .from('domains')
                .insert({
                  merchant_id: transaction.merchant_id,
                  domain: fallbackDomain,
                  tld: fallbackTld,
                  domain_type: 'purchased',
                  status: 'pending',
                  is_primary: false,
                  ssl_status: 'pending',
                  purchase_price: domainPurchaseAmount,
                  renewal_price: domainPurchaseAmount,
                  registered_at: nowIso,
                  auto_renew: true,
                  nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
                });

              if (fallbackInsertError) {
                logger.error({
                  message:
                    'Failed to persist fallback pending domain record after fulfillment error',
                  domain: fallbackDomain,
                  merchantId: transaction.merchant_id,
                  reference,
                  error: fallbackInsertError,
                });
              }
            }
          } catch (fallbackPersistError) {
            logger.error({
              message: 'Fallback domain persistence threw unexpectedly',
              domain: fallbackDomain,
              merchantId: transaction.merchant_id,
              reference,
              error: fallbackPersistError,
            });
          }
        }
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
        .select(
          // A1: include tax_basis, gift_wrapping_fee, tax_amount,
          // discount_amount so the outbox helper can run a real
          // financialConsistency() check on the paid order. Without these,
          // FIRS / loyalty executors (wired in B3.5) would always see the
          // order as `tax_basis_unclassified` and short-circuit to failed.
          'id, merchant_id, order_number, customer_id, total, subtotal, shipping_fee, gift_wrapping_fee, tax_amount, discount_amount, tax_basis, customer_name, customer_email, customer_phone, shipping_address, currency, payment_status, shipping_status, updated_at, ad_tracking, order_items(id, product_id, name, price, quantity, subtotal, variant_name)'
        )
        .single();

      if (orderError) {
        logger.error({
          message: 'Failed to update order',
          orderId: transaction.order_id,
          error: orderError,
        });
        // Review feedback (#1563 thread #1): the outbox-based settlement
        // path is gated on a successful order update. Without this
        // fallback, a transient order-update failure would leave the
        // merchant uncredited even though the customer paid; webhook
        // retries short-circuit because the transaction is already
        // marked completed. Record settlement directly here using
        // transaction-level data (we don't need the fresh order row).
        // Idempotency is enforced by the partial UNIQUE index from A0,
        // so a later replay with a successful order update is a no-op.
        try {
          const grossAmount = Number(transaction.amount) || 0;
          const gatewayFee = extractVerifiedGatewayFeeNgn(
            gateway,
            gatewayResponse
          );
          const platformFee =
            Number(transaction.platform_fee) ||
            calculatePlatformFee(grossAmount * 100).platformFee / 100;
          const { error: fallbackSettlementError } = await supabase.rpc(
            'record_merchant_settlement',
            {
              p_merchant_id: transaction.merchant_id,
              p_source_type: 'order',
              p_source_id: transaction.order_id,
              p_gateway: gateway,
              p_gateway_reference: transaction.gateway_reference ?? reference,
              p_gross_amount: grossAmount,
              p_gateway_fee: gatewayFee,
              p_platform_fee: platformFee,
              p_description: `Order payment via ${gateway} (order update failed)`,
              p_metadata: {
                [`${gateway}_reference`]: reference,
                verified_gateway_fee: gatewayFee,
                order_update_failed: true,
              },
            }
          );
          if (fallbackSettlementError) {
            logger.warn({
              message:
                'record_merchant_settlement errored on order-update-fail fallback path',
              error: fallbackSettlementError,
              orderId: transaction.order_id,
              reference,
            });
          }
        } catch (fallbackSettlementThrew) {
          logger.warn({
            message:
              'record_merchant_settlement threw on order-update-fail fallback path',
            error: fallbackSettlementThrew,
            orderId: transaction.order_id,
            reference,
          });
        }
      } else {
        logger.info({
          message: 'Order updated successfully',
          orderId: transaction.order_id,
        });

        // Send push notification to merchant (non-blocking)
        after(async () => {
          const orderAmount = Number.parseFloat(order.total || '0');
          const orderNumber =
            order.order_number || order.id.slice(0, 8).toUpperCase();

          try {
            await notifyNewOrder(
              transaction.merchant_id,
              order.id,
              orderNumber,
              order.customer_name || 'Customer',
              orderAmount,
              order.currency || 'NGN'
            );
          } catch (pushError) {
            logger.warn({
              message: 'New order push notification failed',
              error: pushError,
            });
          }

          try {
            await notifyPaymentReceived(
              transaction.merchant_id,
              orderAmount,
              order.currency || 'NGN',
              orderNumber,
              order.id
            );
            logger.info({
              message: 'Push notification sent to merchant',
              merchantId: transaction.merchant_id,
              orderId: transaction.order_id,
            });
          } catch (pushError) {
            logger.warn({
              message: 'Payment received push notification failed',
              error: pushError,
            });
          }
        });

        // Δ-7 / A1: route paid-order side effects through the
        // `payment_side_effects` outbox so replays (cron, manual reconcile,
        // duplicate webhook) can't double-execute. Each step claims its own
        // row by (order_id, step); the mark-completed UPDATE is token-gated
        // so a stale-claim takeover by a peer worker can't double-mark.
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

        // Review feedback (CodeRabbit P1, Critical): destructure the
        // error so transient fetch failures don't get silently coerced
        // into a permanent `skipped` outbox state. Previously only
        // `data` was destructured: a transient blip (network hiccup,
        // PgBouncer reconnect, brief DB unavailability) would leave
        // merchantDetails undefined → executor returned
        // `{ skipped: ... }` (a SUCCESS value) → outbox marked the step
        // `completed` → replay never re-attempts → customer permanently
        // loses confirmation email. Now: distinguish PGRST116 (no rows
        // — genuinely-missing merchant; not retryable) from any other
        // error code (transient — throw so the executor catch marks the
        // step `failed` and replay re-runs).
        const { data: merchantDetails, error: merchantFetchError } =
          await supabase
            .from('merchants')
            .select(
              'business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
            )
            .eq('id', transaction.merchant_id)
            .single();

        const paidEmailExecutor: StepExecutor = async () => {
          // Non-PGRST116 errors are transient: throw so replay retries.
          if (merchantFetchError && merchantFetchError.code !== 'PGRST116') {
            throw new Error(
              `merchant_fetch_error: ${merchantFetchError.message}`
            );
          }
          // PGRST116 (merchant row genuinely missing) or missing customer
          // email (guest checkout) is permanently un-emailable. Skipping
          // is the correct terminal state.
          if (!(merchantDetails && order.customer_email)) {
            return { skipped: 'missing_merchant_or_customer_email' };
          }

          const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;
          const emailItems = (order.order_items || []).map(
            (item: Record<string, unknown>) => ({
              name:
                typeof item.variant_name === 'string' &&
                item.variant_name.trim().length > 0
                  ? `${(item.name as string) || 'Product'} (${item.variant_name})`
                  : (item.name as string) || 'Product',
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
            merchantTin: merchantDetails.tax_identification_number ?? undefined,
            merchantRcNumber: merchantDetails.cac_rc_number ?? undefined,
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

          const emailResult = await sendEmail({
            to: order.customer_email,
            toName: order.customer_name,
            subject: `Order Confirmation - #${emailData.orderNumber}`,
            htmlContent,
            textContent,
            replyTo: replyToEmail,
            emailType: 'orders',
            fromName: senderName,
            // Δ-61: ZeptoMail has no Idempotency-Key. The
            // payment_side_effects claim row is the dedup record; this
            // client_reference gives us a server-side audit trail showing
            // which sends actually went out.
            clientReference: `order:${order.id}:paid_email`,
            auditContext: {
              merchantId: order.merchant_id,
              orderId: order.id,
              customerId: order.customer_id,
              metadata: {
                trigger: 'paystack_payment_confirmation',
              },
            },
          });

          if (!emailResult.success) {
            // Throw → outbox marks failed; replay retakes the claim.
            throw new Error(
              emailResult.error || emailResult.errorCode || 'email_failed'
            );
          }
          return { messageId: emailResult.messageId };
        };

        // Review feedback (#1563 thread #2): ad-platform calls
        // (FB CAPI / TikTok / Snap / GA4) are slow third-party APIs.
        // Pre-A1 they ran via `after(...)` so the webhook response
        // wasn't blocked. The outbox helper's await put them back on
        // the response path, raising webhook timeout/retry risk. Run
        // them via `after(...)` here, OUTSIDE the outbox helper. The
        // ad-platform side already deduplicates by deterministic
        // event_id (see triggerPurchaseConversion), so we don't need
        // outbox replay tracking specifically for this step.
        after(async () => {
          try {
            await triggerPurchaseConversion(
              supabase,
              transaction.merchant_id,
              order
            );
          } catch (adTrackingErr) {
            logger.warn({
              message: 'Ad-tracking conversion failed (after-response path)',
              error: adTrackingErr,
              orderId: order.id,
            });
          }
        });

        const settlementExecutor: StepExecutor = async () => {
          const grossAmount = Number(transaction.amount) || 0;
          // Δ-0b: source the gateway fee from the verified Paystack
          // response (Korapay verify has no fee field, returns 0).
          const gatewayFee = extractVerifiedGatewayFeeNgn(
            gateway,
            gatewayResponse
          );
          const platformFee =
            Number(transaction.platform_fee) ||
            calculatePlatformFee(grossAmount * 100).platformFee / 100;

          const { error: settlementError } = await supabase.rpc(
            'record_merchant_settlement',
            {
              p_merchant_id: transaction.merchant_id,
              p_source_type: 'order',
              p_source_id: order.id,
              p_gateway: gateway,
              // Δ-22: settlement key is our BAC-*; Paystack ref → metadata only.
              p_gateway_reference: transaction.gateway_reference ?? reference,
              p_gross_amount: grossAmount,
              p_gateway_fee: gatewayFee,
              p_platform_fee: platformFee,
              p_description: `Order payment via ${gateway}`,
              p_metadata: {
                [`${gateway}_reference`]: reference,
                verified_gateway_fee: gatewayFee,
              },
            }
          );
          if (settlementError) {
            throw new Error(settlementError.message);
          }
          return {
            gross_amount: grossAmount,
            gateway_fee: gatewayFee,
            platform_fee: platformFee,
          };
        };

        const sideEffectsResult = await applyPaidOrderSideEffects({
          supabase,
          order: {
            id: order.id,
            merchant_id: order.merchant_id,
            payment_status: 'paid',
            tax_basis:
              (order as Record<string, unknown>).tax_basis === 'exclusive' ||
              (order as Record<string, unknown>).tax_basis === 'inclusive'
                ? ((order as Record<string, unknown>).tax_basis as
                    | 'exclusive'
                    | 'inclusive')
                : null,
            subtotal: Number((order as Record<string, unknown>).subtotal) || 0,
            shipping_fee:
              Number((order as Record<string, unknown>).shipping_fee) || 0,
            gift_wrapping_fee:
              Number((order as Record<string, unknown>).gift_wrapping_fee) || 0,
            tax_amount:
              Number((order as Record<string, unknown>).tax_amount) || 0,
            discount_amount:
              Number((order as Record<string, unknown>).discount_amount) || 0,
            total: Number((order as Record<string, unknown>).total) || 0,
          },
          transaction: {
            id: transaction.id,
            order_id: order.id,
            merchant_id: transaction.merchant_id,
            gateway_reference: transaction.gateway_reference ?? null,
            amount: transaction.amount,
          },
          gatewayResponse,
          actor: `webhook:${reference}`,
          executors: {
            paid_email: paidEmailExecutor,
            // ad_tracking_conversion intentionally NOT in the outbox —
            // see the `after(() => triggerPurchaseConversion(...))`
            // block above (review feedback #1563 thread #2).
            merchant_settlement: settlementExecutor,
          },
        });

        logger.info({
          message: 'payment_side_effects executed',
          orderId: order.id,
          reference,
          ranSteps: sideEffectsResult.ranSteps,
          skippedSteps: sideEffectsResult.skippedSteps,
          failedSteps: sideEffectsResult.failedSteps,
          concurrentTakeoverSteps: sideEffectsResult.concurrentTakeoverSteps,
        });
      }
    }

    // Record settlement for domain purchases (no order_id → outside the
    // outbox, which is keyed on order_id). Order-bearing transactions
    // record settlement via the `merchant_settlement` step in the outbox.
    const isDomainPurchase =
      (transaction.metadata as Record<string, unknown>)?.transaction_type ===
      'domain_purchase';
    if (isDomainPurchase) {
      try {
        const grossAmount = Number(transaction.amount) || 0;
        const gatewayFee = extractVerifiedGatewayFeeNgn(
          gateway,
          gatewayResponse
        );
        const platformFee =
          Number(transaction.platform_fee) ||
          calculatePlatformFee(grossAmount * 100).platformFee / 100;

        const { error: settlementError } = await supabase.rpc(
          'record_merchant_settlement',
          {
            p_merchant_id: transaction.merchant_id,
            p_source_type: 'domain_purchase',
            p_source_id: transaction.id,
            p_gateway: gateway,
            p_gateway_reference: transaction.gateway_reference ?? reference,
            p_gross_amount: grossAmount,
            p_gateway_fee: gatewayFee,
            p_platform_fee: platformFee,
            p_description: `Domain purchase via ${gateway}`,
            p_metadata: {
              [`${gateway}_reference`]: reference,
              verified_gateway_fee: gatewayFee,
            },
          }
        );

        if (settlementError) {
          logger.warn({
            message: 'Failed to record domain-purchase settlement',
            error: settlementError,
            reference,
          });
        } else {
          logger.info({
            message: 'Domain-purchase settlement recorded',
            reference,
            gateway,
            grossAmount,
          });
        }
      } catch (settlementError) {
        logger.warn({
          message: 'Domain-purchase settlement error',
          error: settlementError,
        });
      }
    }

    if (gateway === 'paystack') {
      const reconciliationFailure = await reconcileAgenticPaystackDvaSession({
        metadata,
        reference,
        supabase,
        transaction: {
          merchant_id: transaction.merchant_id,
          order_id: transaction.order_id,
        },
      });
      if (reconciliationFailure) {
        return reconciliationFailure;
      }
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
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
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

    // Validate reference with same Zod schema used in POST handler
    const referenceResult = referenceSchema.safeParse(reference);
    if (!referenceResult.success) {
      return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
    }
    const safeReference = referenceResult.data;

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
      .eq('gateway_reference', safeReference)
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
        ? await verifyPaystackPayment(safeReference)
        : await verifyKorapayPayment(safeReference);

    return NextResponse.json({
      success: true,
      gateway,
      payment: paymentData,
    });
  } catch (error) {
    logger.error({
      message: 'Payment verification error',
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
    });
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
