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

Deno.serve(async (req) => {
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
      const totalAmount = orders.reduce((sum, order) => {
        const amount = Number(order.total_amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);

      // Skip if total is invalid or below minimum threshold (₦100)
      if (!Number.isFinite(totalAmount) || totalAmount < 100) continue;

      // Define orderIds before try block so it's accessible in catch for rollback
      const orderIds = orders.map((o) => o.id);

      // 3. Initiate Transfer with Paystack
      try {
        // Mark orders as processing BEFORE initiating transfer to prevent duplicates
        const { error: lockError } = await supabase
          .from('orders')
          .update({ payout_status: 'processing' })
          .in('id', orderIds);

        if (lockError) {
          console.error(
            'Failed to lock orders for merchant %s:',
            merchant.id,
            lockError
          );
          continue;
        }

        // A. Create/Fetch Transfer Recipient
        // We create it every time to be safe (idempotent if same details)
        // 2026 best practice: Add timeout to prevent edge function hangs
        const recipientResponse = await fetch(
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
            signal: AbortSignal.timeout(10000), // 10s timeout
          }
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
        // Format: baci-payout-{merchantId}-{date}-{orderCount}-{amount}
        const idempotencyRef = `baci-payout-${merchant.id}-${today.toISOString().slice(0, 10)}-${orders.length}-${transferAmountKobo}`;

        const transferResponse = await fetch(
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
              reference: idempotencyRef, // Idempotency key prevents duplicate transfers
            }),
            signal: AbortSignal.timeout(10000), // 10s timeout
          }
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

        // 4. Update Database
        // A. Create Payout Record
        const { data: payout, error: payoutError } = await supabase
          .from('payouts')
          .insert({
            merchant_id: merchant.id,
            amount: totalAmount,
            currency: 'NGN',
            status: 'pending', // Paystack status is usually 'pending' or 'success'
            reference: transferCode, // Using transfer code as reference
            payout_mode: merchant.payout_mode,
            processed_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (payoutError) throw payoutError;

        // B. Update Orders with payout reference
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payout_status: 'pending',
            payout_id: payout.id,
          })
          .in('id', orderIds);

        if (updateError) throw updateError;

        results.push({
          merchant: merchant.business_name,
          amount: totalAmount,
          status: 'success',
          reference: transferCode,
        });
      } catch (err: unknown) {
        console.error('Payout logic failed for merchant %s:', merchant.id, err);
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';

        // Rollback: Reset orders back to unpaid status if transfer failed
        await supabase
          .from('orders')
          .update({ payout_status: 'unpaid' })
          .in('id', orderIds);

        results.push({
          merchant: merchant.business_name,
          amount: totalAmount,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
