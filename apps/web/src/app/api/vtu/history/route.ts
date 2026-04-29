import { after, type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { backfillVtuVoucherPin } from '@/lib/vtu-fulfillment';
import { historyQuerySchema } from '@/schemas/vtu';

const TOKEN_BACKFILL_TYPES = new Set(['electricity', 'cable_tv', 'betting']);
const MAX_TOKEN_BACKFILL_SCHEDULES = 3;
const PAYMENT_STATUS_BATCH_SIZE = 250;

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = historyQuerySchema.safeParse({
      merchantSlug: searchParams.get('merchantSlug'),
      type: searchParams.get('type') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { merchantSlug, type, limit } = parsed.data;

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    let customer = null;

    const { data: customerByUserId } = await supabase
      .from('customers')
      .select('id, user_id')
      .eq('merchant_id', merchant.id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (customerByUserId) {
      customer = customerByUserId;
    } else if (auth.user.email) {
      const { data: customerByEmail } = await supabase
        .from('customers')
        .select('id, user_id')
        .eq('merchant_id', merchant.id)
        .eq('email', auth.user.email)
        .maybeSingle();

      if (customerByEmail) {
        customer = customerByEmail;

        if (!customerByEmail.user_id) {
          void supabase
            .from('customers')
            .update({ user_id: auth.user.id })
            .eq('id', customerByEmail.id);
        }
      }
    }

    if (!customer) {
      return NextResponse.json({ transactions: [] });
    }

    let query = supabase
      .from('vtu_transactions')
      .select(
        'id, created_at, type, status, amount, network_provider, phone_number, biller_name, biller_item_code, customer_identifier, customer_name, request_reference, transaction_id, error_message, customer_cashback, metadata'
      )
      .eq('merchant_id', merchant.id)
      .eq('customer_id', customer.id);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: transactions, error: transactionsError } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (transactionsError) {
      console.error('Failed to fetch customer VTU history:', transactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    const paymentReferences = Array.from(
      new Set(
        (transactions ?? [])
          .map((transaction) => {
            const metadata = (transaction.metadata ?? {}) as Record<
              string,
              unknown
            >;
            return typeof metadata.paymentReference === 'string'
              ? metadata.paymentReference
              : null;
          })
          .filter((reference): reference is string => Boolean(reference))
      )
    );
    const paymentStatusByReference = new Map<string, string>();
    let paymentStatusPartialFailure = false;

    if (paymentReferences.length > 0) {
      for (
        let index = 0;
        index < paymentReferences.length;
        index += PAYMENT_STATUS_BATCH_SIZE
      ) {
        const paymentReferenceBatch = paymentReferences.slice(
          index,
          index + PAYMENT_STATUS_BATCH_SIZE
        );
        const { data: paymentRows, error: paymentRowsError } = await supabase
          .from('transactions')
          .select('gateway_reference, status')
          .eq('merchant_id', merchant.id)
          .in('gateway_reference', paymentReferenceBatch);

        if (paymentRowsError) {
          paymentStatusPartialFailure = true;
          console.error('Failed to fetch VTU payment statuses:', {
            error: paymentRowsError,
            paymentReferenceBatchSize: paymentReferenceBatch.length,
          });
        } else {
          for (const paymentRow of paymentRows ?? []) {
            if (
              typeof paymentRow.gateway_reference === 'string' &&
              typeof paymentRow.status === 'string'
            ) {
              paymentStatusByReference.set(
                paymentRow.gateway_reference,
                paymentRow.status
              );
            }
          }
        }
      }
    }

    let scheduledTokenBackfills = 0;
    const transactionsWithVoucherPins = (transactions ?? []).map(
      (transaction) => {
        const metadata = (transaction.metadata ?? {}) as Record<
          string,
          unknown
        >;
        const voucherPin =
          typeof metadata.voucherPin === 'string' ? metadata.voucherPin : null;

        return { metadata, transaction, voucherPin };
      }
    );

    for (const {
      metadata,
      transaction,
      voucherPin,
    } of transactionsWithVoucherPins) {
      if (
        voucherPin !== null ||
        transaction.status !== 'successful' ||
        !TOKEN_BACKFILL_TYPES.has(String(transaction.type)) ||
        scheduledTokenBackfills >= MAX_TOKEN_BACKFILL_SCHEDULES
      ) {
        continue;
      }

      scheduledTokenBackfills += 1;
      after(async () => {
        try {
          await backfillVtuVoucherPin({
            billRequestRef:
              typeof transaction.request_reference === 'string'
                ? transaction.request_reference
                : null,
            billResponseReference:
              typeof transaction.transaction_id === 'string'
                ? transaction.transaction_id
                : null,
            metadata,
            supabase,
            transactionId: String(transaction.id),
          });
        } catch (error) {
          console.error('Failed to backfill VTU voucher pin from history:', {
            error,
            transactionId: transaction.id,
            transactionReference: transaction.transaction_id,
          });
        }
      });
    }

    return NextResponse.json({
      payment_status_partial_failure: paymentStatusPartialFailure,
      transactions: transactionsWithVoucherPins.map(
        ({ transaction, voucherPin }) => {
          const {
            metadata: transactionMetadata,
            transaction_id: _transactionId,
            ...publicTransaction
          } = transaction;
          const metadata = (transactionMetadata ?? {}) as Record<
            string,
            unknown
          >;
          const dataPlanCode =
            typeof metadata.dataPlanCode === 'string'
              ? metadata.dataPlanCode
              : null;
          const paymentGateway =
            metadata.gateway === 'paystack' || metadata.gateway === 'korapay'
              ? metadata.gateway
              : null;
          const paymentReference =
            typeof metadata.paymentReference === 'string'
              ? metadata.paymentReference
              : null;

          return {
            ...publicTransaction,
            amount: Number(transaction.amount) || 0,
            customer_cashback:
              transaction.customer_cashback != null
                ? Number(transaction.customer_cashback)
                : null,
            payment_gateway: paymentGateway,
            payment_reference: paymentReference,
            payment_status: paymentReference
              ? (paymentStatusByReference.get(paymentReference) ?? null)
              : null,
            repeat_data_plan_code: dataPlanCode,
            voucher_pin: voucherPin,
          };
        }
      ),
    });
  } catch (error) {
    console.error('Customer VTU history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
