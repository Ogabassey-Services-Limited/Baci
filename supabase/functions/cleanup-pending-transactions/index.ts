import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * 2026 Best Practice: Automated Payment Verification & Cleanup
 *
 * Supports: Paystack, Juicyway, Korapay
 * Logic:
 * 1. Find 'pending' transactions created > 1 hour ago (reduced from 24h for better reactivity)
 * 2. For each, call the respective gateway API to verify actual status
 * 3. Update DB if gateway says 'success' or mark as 'failed' if gateway confirms failure
 * 4. Log inconsistencies for manual review if necessary
 */

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const now = new Date();
  console.log(`[${now.toISOString()}] Starting transaction cleanup...`);

  // 1. Fetch pending transactions older than 1 hour
  const { data: stuckTransactions, error: fetchError } = await supabase
    .from('transactions')
    .select('id, gateway, gateway_reference, status, order_id')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (fetchError) {
    console.error('Error fetching stuck transactions:', fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
    });
  }

  console.log(`Found ${stuckTransactions?.length ?? 0} stuck transactions.`);

  const results = [];

  for (const tx of stuckTransactions ?? []) {
    let actualStatus: 'success' | 'failed' | 'pending' | 'unknown';

    try {
      if (!tx.gateway_reference) {
        console.warn(`Transaction ${tx.id} has no gateway_reference.`);
        continue;
      }

      if (tx.gateway === 'paystack') {
        actualStatus = await verifyPaystack(tx.gateway_reference);
      } else if (tx.gateway === 'juicyway') {
        actualStatus = await verifyJuicyway(tx.gateway_reference);
      } else if (tx.gateway === 'korapay') {
        actualStatus = await verifyKorapay(tx.gateway_reference);
      } else {
        console.warn(
          `Gateway ${tx.gateway} not supported for automated verification.`
        );
        continue;
      }

      if (actualStatus === 'success') {
        // Update transaction and order
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('id', tx.id);

        if (!updateError && tx.order_id) {
          await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', tx.order_id);
        }

        results.push({
          id: tx.id,
          gateway_reference: tx.gateway_reference,
          status: 'success',
        });
      } else if (actualStatus === 'failed') {
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', tx.id);

        results.push({
          id: tx.id,
          gateway_reference: tx.gateway_reference,
          status: 'failed',
        });
      } else {
        results.push({
          id: tx.id,
          gateway_reference: tx.gateway_reference,
          status: actualStatus,
        });
      }
    } catch (err) {
      console.error(`Error verifying transaction ${tx.id}:`, err);
      results.push({
        id: tx.id,
        gateway_reference: tx.gateway_reference,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new Response(
    JSON.stringify({
      processed: stuckTransactions?.length ?? 0,
      details: results,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

/**
 * Paystack Verification
 */
async function verifyPaystack(
  reference: string
): Promise<'success' | 'failed' | 'pending'> {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY not set');

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
    }
  );
  if (res.status === 404) return 'failed';
  const data = await res.json();

  if (data.status && data.data.status === 'success') return 'success';
  if (data.status && data.data.status === 'failed') return 'failed';
  return 'pending';
}

/**
 * Juicyway Verification
 */
async function verifyJuicyway(
  reference: string
): Promise<'success' | 'failed' | 'pending'> {
  const secret = Deno.env.get('JUICYWAY_SECRET_KEY');
  const baseUrl =
    Deno.env.get('JUICYWAY_BASE_URL') || 'https://api.spendjuice.com';
  if (!secret) throw new Error('JUICYWAY_SECRET_KEY not set');

  const res = await fetch(`${baseUrl}/payments/${reference}`, {
    headers: { Authorization: secret },
  });
  if (res.status === 404) return 'failed';
  const data = await res.json();

  const payment = data.data || data;
  if (payment.status === 'succeeded') return 'success';
  if (payment.status === 'failed' || payment.status === 'cancelled')
    return 'failed';
  return 'pending';
}

/**
 * Korapay Verification
 */
async function verifyKorapay(
  reference: string
): Promise<'success' | 'failed' | 'pending'> {
  const secret = Deno.env.get('KORAPAY_SECRET_KEY');
  if (!secret) throw new Error('KORAPAY_SECRET_KEY not set');

  const res = await fetch(
    `https://api.korapay.com/merchant/api/v1/charges/${reference}/verify`,
    {
      headers: { Authorization: `Bearer ${secret}` },
    }
  );
  if (res.status === 404) return 'failed';
  const data = await res.json();

  if (data.status && data.data.status === 'success') return 'success';
  if (
    data.status &&
    (data.data.status === 'failed' || data.data.status === 'expired')
  )
    return 'failed';
  return 'pending';
}
