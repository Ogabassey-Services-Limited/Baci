import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    merchant_id: string;
    total_amount: number;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

        if (!paystackSecretKey) {
            throw new Error('Missing PAYSTACK_SECRET_KEY');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Determine Eligibility Logic
        const today = new Date();
        const isMonday = today.getDay() === 1;

        // Fetch all merchants with auto_payout_enabled
        const { data: merchants, error: merchantError } = await supabase
            .from('merchants')
            .select('id, business_name, bank_code, bank_account_number, payout_mode, auto_payout_enabled')
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
                console.error(`Error fetching orders for merchant ${merchant.id}:`, orderError);
                continue;
            }

            if (!orders || orders.length === 0) continue;

            // Calculate Total Logic
            const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

            // Minimum payout threshold (e.g., ₦100)
            if (totalAmount < 100) continue;

            // 3. Initiate Transfer with Paystack
            try {
                // A. Create/Fetch Transfer Recipient
                // We create it every time to be safe (idempotent if same details)
                const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
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
                });

                const recipientData = await recipientResponse.json();
                if (!recipientData.status) {
                    throw new Error(`Failed to create recipient: ${recipientData.message}`);
                }
                const recipientCode = recipientData.data.recipient_code;

                // B. Initiate Transfer
                // Note: Paystack amount is in kobo (subunits)
                // Adjust logic if totalAmount is already in kobo? 
                // Assuming database stores main unit (Naira), so multiply by 100.
                // CHECK THIS assumption. Usually apps store main units.
                const transferAmountKobo = Math.round(totalAmount * 100);

                const transferResponse = await fetch('https://api.paystack.co/transfer', {
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
                    }),
                });

                const transferData = await transferResponse.json();
                if (!transferData.status) {
                    throw new Error(`Transfer failed: ${transferData.message}`);
                }

                const transferReference = transferData.data.reference;
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

                // B. Update Orders
                const orderIds = orders.map((o) => o.id);
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

            } catch (err: any) {
                console.error(`Payout logic failed for merchant ${merchant.id}:`, err);
                results.push({
                    merchant: merchant.business_name,
                    amount: totalAmount,
                    status: 'failed',
                    error: err.message,
                });
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
