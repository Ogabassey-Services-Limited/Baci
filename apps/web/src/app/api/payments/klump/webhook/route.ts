import { after, type NextRequest, NextResponse } from 'next/server';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import {
  amountsMatch,
  currenciesMatch,
  getKlumpWebhookSecret,
  getMergedKlumpMetadata,
  hasKlumpIdConflict,
  type JsonRecord,
  parseKlumpWebhookPayload,
  verifyKlumpWebhookSignature,
} from '@/lib/klump-webhook';
import { logger } from '@/lib/logger';
import { calculatePlatformFee } from '@/lib/paystack';
import { createServiceClient } from '@/lib/supabase/service';
import { referenceSchema } from '@/schemas/payments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TransactionRecord {
  amount: number | string | null;
  currency: string | null;
  gateway_reference: string | null;
  id: string;
  merchant_id: string;
  metadata: JsonRecord | null;
  order_id: string | null;
  platform_fee: number | string | null;
  status: string | null;
}

interface PaidOrderRecord {
  currency?: string | null;
  customer_name?: string | null;
  id: string;
  order_number?: string | null;
  total?: number | string | null;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function updateKlumpOrder({
  orderId,
  supabase,
}: {
  orderId: string;
  supabase: ReturnType<typeof createServiceClient>;
}) {
  return supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      shipping_status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('id, merchant_id, order_number, customer_name, total, currency')
    .single<PaidOrderRecord>();
}

async function notifyKlumpPaidOrder({
  amount,
  currency,
  merchantId,
  order,
}: {
  amount: number;
  currency: string;
  merchantId: string;
  order: PaidOrderRecord;
}) {
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();

  try {
    await notifyNewOrder(
      merchantId,
      order.id,
      orderNumber,
      order.customer_name || 'Customer',
      amount,
      currency
    );
    await notifyPaymentReceived(
      merchantId,
      amount,
      currency,
      orderNumber,
      order.id
    );
  } catch (error) {
    logger.warn({ message: 'Klump payment notification failed', error });
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = getKlumpWebhookSecret();

  if (!secret) {
    logger.error({
      message: 'KLUMP_WEBHOOK_SECRET or KLUMP_SECRET_KEY is not configured',
    });
    return errorResponse('Webhook secret not configured', 500);
  }

  const validSignature = verifyKlumpWebhookSignature({
    rawBody,
    secret,
    signature: request.headers.get('x-klump-signature'),
  });
  if (!validSignature) {
    logger.warn({ message: 'Invalid Klump webhook signature' });
    return errorResponse('Invalid signature', 401);
  }

  const parsedPayload = parseKlumpWebhookPayload(rawBody);
  if (!parsedPayload.success) {
    return errorResponse(parsedPayload.error, 400);
  }

  if (!parsedPayload.details) {
    logger.info({ message: 'Ignoring non-success Klump webhook event' });
    return NextResponse.json({ message: 'Event ignored' });
  }

  const { details, payload } = parsedPayload;
  const referenceResult = referenceSchema.safeParse(details.merchantReference);
  if (!referenceResult.success) {
    return errorResponse('Invalid reference', 400);
  }

  const supabase = createServiceClient();
  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .select(
      'id, merchant_id, order_id, amount, currency, gateway_reference, status, platform_fee, metadata'
    )
    .eq('gateway', 'klump')
    .eq('gateway_reference', referenceResult.data)
    .maybeSingle<TransactionRecord>();

  if (transactionError || !transaction) {
    logger.error({
      message: 'Klump transaction not found',
      error: transactionError,
      reference: referenceResult.data,
    });
    return errorResponse('Transaction not found', 404);
  }

  if (!amountsMatch(transaction.amount, details.amount)) {
    return errorResponse('Payment amount mismatch', 400);
  }

  if (!currenciesMatch(transaction.currency, details.currency)) {
    return errorResponse('Payment currency mismatch', 400);
  }

  if (hasKlumpIdConflict(transaction.metadata, details.transactionId)) {
    return errorResponse('Klump transaction id conflict', 409);
  }

  if (transaction.status === 'completed') {
    return NextResponse.json({ message: 'Already processed', success: true });
  }

  let order: PaidOrderRecord | null = null;
  if (transaction.order_id) {
    const { data: updatedOrder, error: orderError } = await updateKlumpOrder({
      orderId: transaction.order_id,
      supabase,
    });

    if (orderError || !updatedOrder) {
      logger.error({
        message: 'Failed to update Klump order',
        error: orderError,
        orderId: transaction.order_id,
      });
      return errorResponse('Failed to update order', 500);
    }

    order = updatedOrder;
  }

  const { data: updatedTransaction, error: updateError } = await supabase
    .from('transactions')
    .update({
      gateway_response: payload,
      metadata: getMergedKlumpMetadata({
        details,
        headers: request.headers,
        metadata: transaction.metadata,
      }),
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id)
    .neq('status', 'completed')
    .select('id')
    .maybeSingle<{ id: string }>();

  if (updateError) {
    logger.error({
      message: 'Failed to update Klump transaction',
      error: updateError,
      reference: referenceResult.data,
    });
    return errorResponse('Failed to update transaction', 500);
  }

  if (!updatedTransaction) {
    return NextResponse.json({ message: 'Already processed', success: true });
  }

  const grossAmount = Number(transaction.amount) || details.amount;
  const platformFee =
    Number(transaction.platform_fee) ||
    calculatePlatformFee(grossAmount * 100).platformFee / 100;

  const { error: settlementError } = await supabase.rpc(
    'record_merchant_settlement',
    {
      p_description: 'Order payment via Klump',
      p_gateway: 'klump',
      p_gateway_fee: 0,
      p_gateway_reference: referenceResult.data,
      p_gross_amount: grossAmount,
      p_merchant_id: transaction.merchant_id,
      p_metadata: {
        klump_reference: referenceResult.data,
        klump_transaction_id: details.transactionId,
        klump_webhook_id: request.headers.get('x-klump-webhook-id'),
      },
      p_platform_fee: platformFee,
      p_source_id: transaction.order_id,
      p_source_type: 'order',
    }
  );

  if (settlementError) {
    logger.warn({
      message: 'Failed to record Klump merchant settlement',
      error: settlementError,
      reference: referenceResult.data,
    });
  }

  if (order) {
    after(() =>
      notifyKlumpPaidOrder({
        amount: Number(order?.total) || grossAmount,
        currency: order?.currency || transaction.currency || 'NGN',
        merchantId: transaction.merchant_id,
        order,
      })
    );
  }

  return NextResponse.json({
    message: 'Klump payment processed successfully',
    success: true,
  });
}
