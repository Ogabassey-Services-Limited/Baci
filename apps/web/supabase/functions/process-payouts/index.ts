import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface Merchant {
  id: string;
  business_name: string;
  bank_code: string;
  bank_account_number: string;
  payout_mode: 'instant' | 'weekly';
  auto_payout_enabled: boolean;
}

interface Order {
  id: string;
  total_amount: number | string | null;
}

// Helper to generate idempotency reference (2026 best practice: SHA-256 fingerprinting)
// Format: baci-payout-{merchantId}-{date}-{amount}-{idsHash}
async function generateIdempotencyRef(
  merchantId: string,
  date: Date,
  orderIds: string[],
  amountKobo: number
): Promise<string> {
  // Sort IDs to ensure deterministic reference regardless of fetch order
  const idString = [...orderIds].sort().join(',');

  // 2026 Best Practice: Include all critical parameters in the hash for maximum collision resistance
  const encoder = new TextEncoder();
  const data = encoder.encode(
    `${merchantId}:${date.toISOString().slice(0, 10)}:${amountKobo}:${idString}`
  );
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const idHash = hashArray
    .slice(0, 8) // First 8 bytes are sufficient for this context
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `baci-payout-${merchantId}-${date.toISOString().slice(0, 10)}-${amountKobo}-${idHash}`;
}

// Helper for fetch with explicit timeout error context (2026 best practice)
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  operationName: string,
  timeoutMs = 10000
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    // Provide better error context for timeout errors
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(`${operationName} timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey || !paystackSecretKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Determine Eligibility Logic
    const today = new Date();
    const isMonday = today.getDay() === 1;

    // Fetch all merchants with auto_payout_enabled
    const { data: merchants, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, bank_code, bank_account_number, payout_mode, auto_payout_enabled'
      )
      .eq('auto_payout_enabled', true)
      .not('bank_code', 'is', null)
      .not('bank_account_number', 'is', null);

    if (merchantError) throw merchantError;

    const eligibleMerchants = (merchants as Merchant[]).filter((m) => {
      if (m.payout_mode === 'instant') return true; // Runs daily/frequently
      if (m.payout_mode === 'weekly' && isMonday) return true; // Runs only on Mondays
      return false;
    });

    const results = [];

    // 2. Process Each Merchant
    for (const merchant of eligibleMerchants) {
      // Fetch unpaid completed orders
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('merchant_id', merchant.id)
        .eq('status', 'completed')
        .eq('payout_status', 'unpaid');

      if (orderError) {
        console.error(
          'Error fetching orders for merchant %s:',
          merchant.id,
          orderError
        );
        continue;
      }

      if (!orders || orders.length === 0) continue;

      // Calculate Total Logic (with NaN protection)
      const totalAmount = (orders as Order[]).reduce((sum, order) => {
        const amount = Number(order.total_amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);

      // Skip if total is invalid or below minimum threshold (₦100)
      if (!Number.isFinite(totalAmount) || totalAmount < 100) continue;

      // Define orderIds and idempotencyRef before try block so they're accessible in catch for rollback
      const orderIds = (orders as Order[]).map((o) => o.id);
      let idempotencyRef: string | null = null;

      // 3. Initiate Transfer with Paystack
      try {
        // Mark orders as processing BEFORE initiating transfer to prevent duplicates
        const { data: lockedOrders, error: lockError } = await supabase
          .from('orders')
          .update({ payout_status: 'processing' })
          .in('id', orderIds)
          .eq('payout_status', 'unpaid')
          .select('id');

        if (lockError) {
          console.error(
            'Failed to lock orders for merchant %s:',
            merchant.id,
            lockError
          );
          continue;
        }
        if (!lockedOrders || lockedOrders.length !== orderIds.length) {
          console.warn(
            'Orders already locked or paid for merchant %s; skipping',
            merchant.id
          );
          continue;
        }

        // A. Create/Fetch Transfer Recipient
        // We create it every time to be safe (idempotent if same details)
        // 2026 best practice: Add timeout to prevent edge function hangs
        const recipientResponse = await fetchWithTimeout(
          'https://api.paystack.co/transferrecipient',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'nuban',
              name: merchant.business_name,
              account_number: merchant.bank_account_number,
              bank_code: merchant.bank_code,
              currency: 'NGN',
            }),
            signal: AbortSignal.timeout(10000),
          },
          'Paystack recipient API call'
        );

        if (!recipientResponse.ok) {
          const errorText = await recipientResponse.text().catch(() => '');
          throw new Error(
            `Paystack API error: ${recipientResponse.status} - ${errorText}`
          );
        }
        const recipientData = await recipientResponse.json();
        if (!recipientData.status || !recipientData.data?.recipient_code) {
          throw new Error(
            `Failed to create recipient: ${recipientData.message || 'Invalid response'}`
          );
        }
        const recipientCode = recipientData.data.recipient_code;

        // B. Initiate Transfer
        // Note: Paystack amount is in kobo (subunits)
        // Database stores main unit (Naira), so multiply by 100.
        // Validation: totalAmount must be positive and within reasonable bounds
        if (totalAmount <= 0 || totalAmount > 10_000_000) {
          throw new Error(`Invalid transfer amount: ${totalAmount}`);
        }
        const transferAmountKobo = Math.round(totalAmount * 100);

        // Generate idempotency reference to prevent double-payouts on retries
        idempotencyRef = await generateIdempotencyRef(
          merchant.id,
          today,
          orderIds,
          transferAmountKobo
        );

        let payoutRecord: { id: string } | null = null;
        const { data: existingPayout } = await supabase
          .from('payouts')
          .select('id, status, reference, initiated_at')
          .eq('reference', idempotencyRef)
          .maybeSingle();

        if (existingPayout) {
          // Payout already exists
          console.log(
            `Payout already exists for merchant ${merchant.id} with reference ${idempotencyRef}, status: ${existingPayout.status}`
          );

          if (existingPayout.status === 'processing') {
            // Check if payout is stale (e.g., initiated > 5 minutes ago)
            // ARIA APG Radio Group Pattern: Skip disabled options during keyboard navigation
            // (Wait, CodeRabbit suggested a staleness check here)
            const initiatedAt = new Date(existingPayout.initiated_at);
            const staleThreshold = 5 * 60 * 1000; // 5 minutes
            if (Date.now() - initiatedAt.getTime() > staleThreshold) {
              console.warn(
                `Stale processing payout detected: ${existingPayout.id}`
              );
              // We'll let it process or fail; at least we're logging it for investigation.
              // For robustness, we'll continue to see if we can "revive" it later if it's failed,
              // but if it's "processing" and stale, we might want to manually intervene or mark failed.
            }

            // If we found a processing payout, it means another run is likely active or stuck
            // We'll link orders anyway to ensure consistency if they missed it last time
            const { error: processingLinkError } = await supabase
              .from('orders')
              .update({
                payout_id: existingPayout.id,
                payout_status: 'processing',
              })
              .in('id', orderIds);
            if (processingLinkError) throw processingLinkError;
            continue;
          }

          // If it was already pending or success, just link orders (idempotent update) and move on
          if (
            existingPayout.status === 'pending' ||
            existingPayout.status === 'success'
          ) {
            const { error: existingLinkError } = await supabase
              .from('orders')
              .update({
                payout_id: existingPayout.id,
                payout_status:
                  existingPayout.status === 'success' ? 'paid' : 'pending',
              })
              .in('id', orderIds);

            if (existingLinkError) {
              console.error(
                'Failed to link orders to existing payout:',
                existingLinkError
              );
              results.push({
                merchantId: merchant.id,
                amount: totalAmount,
                status: 'partial_success',
                reference: idempotencyRef,
                warning: 'Existing payout found but order linking failed',
              });
            }
            continue;
          }

          // 2026 Best Practice: Reuse failed payout records to avoid UNIQUE constraint violations on retry
          if (existingPayout.status === 'failed') {
            const { error: reviveError } = await supabase
              .from('payouts')
              .update({
                status: 'processing',
                error_message: null,
                initiated_at: new Date().toISOString(),
              })
              .eq('id', existingPayout.id);
            if (reviveError) throw reviveError;
            payoutRecord = existingPayout;
          }
        }

        if (!payoutRecord) {
          // 2026 Best Practice: Create payout record BEFORE Paystack transfer
          const { data: insertedPayout, error: payoutError } = await supabase
            .from('payouts')
            .insert({
              merchant_id: merchant.id,
              amount: totalAmount,
              currency: 'NGN',
              status: 'processing', // Mark as processing before transfer
              reference: idempotencyRef, // Use idempotency ref as our reference
              payout_mode: merchant.payout_mode,
              initiated_at: new Date().toISOString(), // Set when initiated, not when processed
            })
            // PERFORMANCE: Explicitly select only the required ID to prevent overfetching full rows
            .select('id')
            .single();

          if (payoutError) throw payoutError;
          payoutRecord = insertedPayout;
        }

        if (!payoutRecord) {
          throw new Error('Payout record could not be created or retrieved');
        }

        // Link orders to payout immediately
        const { error: linkError } = await supabase
          .from('orders')
          .update({ payout_id: payoutRecord.id })
          .in('id', orderIds);

        if (linkError) {
          console.error('Failed to link orders to payout:', linkError);
          // Mark as failed and stop (safety: don't transfer money without links)
          await supabase
            .from('payouts')
            .update({
              status: 'failed',
              error_message: 'Failed to link orders to payout',
            })
            .eq('id', payoutRecord.id);
          throw linkError;
        }

        const transferResponse = await fetchWithTimeout(
          'https://api.paystack.co/transfer',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              source: 'balance',
              amount: transferAmountKobo,
              recipient: recipientCode,
              reason: `Payout for ${orders.length} orders`,
              reference: idempotencyRef, // Same reference for Paystack idempotency
            }),
            signal: AbortSignal.timeout(10000),
          },
          'Paystack transfer API call'
        );

        if (!transferResponse.ok) {
          const errorText = await transferResponse.text().catch(() => '');
          throw new Error(
            `Paystack transfer API error: ${transferResponse.status} - ${errorText}`
          );
        }
        const transferData = await transferResponse.json();
        if (!transferData.status || !transferData.data?.transfer_code) {
          throw new Error(
            `Transfer failed: ${transferData.message || 'Invalid response'}`
          );
        }

        const transferCode = transferData.data.transfer_code;

        // Update payout record with transfer code, status, and processed_at timestamp
        const { error: updatePayoutError } = await supabase
          .from('payouts')
          .update({
            status: 'pending', // Paystack accepted the transfer
            paystack_transfer_code: transferCode,
            processed_at: new Date().toISOString(), // Set when transfer actually succeeds
          })
          .eq('id', payoutRecord.id);

        // Update orders status to pending
        const { error: updateError } = await supabase
          .from('orders')
          .update({ payout_status: 'pending' })
          .in('id', orderIds);

        // 2026 Best Practice: Handle partial success state when transfer succeeds but DB updates fail
        // This prevents silent failures that leave inconsistent state
        if (updatePayoutError || updateError) {
          if (updatePayoutError) {
            console.error(
              'Failed to update payout with transfer code:',
              updatePayoutError
            );
          }
          if (updateError) {
            console.error('Failed to update order payout status:', updateError);
          }
          // Flag partial success - money was sent but records need reconciliation
          results.push({
            merchantId: merchant.id,
            amount: totalAmount,
            status: 'partial_success',
            reference: idempotencyRef,
            transferCode,
            warning:
              'Transfer succeeded but database update failed - requires manual reconciliation',
          });
          continue;
        }

        // 2026 best practice: Use merchant.id instead of business_name to avoid PII in logs/responses
        results.push({
          merchantId: merchant.id,
          amount: totalAmount,
          status: 'success',
          reference: idempotencyRef,
        });
      } catch (err: unknown) {
        console.error('Payout logic failed for merchant %s:', merchant.id, err);
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';

        // Rollback: Reset orders back to unpaid status if transfer failed
        // 2026 Best Practice: Keep payout_id link if payout was created, but mark status failed
        await supabase
          .from('orders')
          .update({ payout_status: 'unpaid' })
          .in('id', orderIds);

        // Update payout record to failed status if it was created
        if (idempotencyRef) {
          await supabase
            .from('payouts')
            .update({ status: 'failed', error_message: errorMessage })
            .eq('reference', idempotencyRef)
            .eq('status', 'processing');
        }

        // 2026 best practice: Use merchant.id and sanitize error for response
        results.push({
          merchantId: merchant.id,
          amount: totalAmount,
          status: 'failed',
          error: 'Payout processing failed',
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    // 2026 best practice: Don't expose internal error details to clients
    console.error('Process payouts failed:', error);
    return new Response(
      JSON.stringify({ error: 'Payout processing encountered an error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Use 500 for server errors, not 400
      }
    );
  }
});
