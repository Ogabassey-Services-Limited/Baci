import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const { record } = await req.json();

    if (!record) {
      return new Response(JSON.stringify({ error: 'No record found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Broadcast the new negotiation request to the merchant's room
    const channel = supabase.channel(`negotiations:${record.merchant_id}`);

    await channel.send({
      type: 'broadcast',
      event: 'new_negotiation',
      payload: {
        id: record.id,
        merchant_id: record.merchant_id,
        type: record.type,
        item_info: record.item_info,
        offered_price: record.offered_price,
        created_at: record.created_at,
      },
    });

    // Send push notification to merchant via centralized Next.js endpoint (fire-and-forget)
    const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL')?.replace(/\/+$/, '');
    const internalSecret = Deno.env.get('INTERNAL_API_SECRET');
    if (siteUrl && internalSecret) {
      // Fire-and-forget — don't block the Edge Function response
      fetch(`${siteUrl}/api/internal/notify-negotiation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          merchantId: record.merchant_id,
          negotiationType: record.type,
          offeredPrice: record.offered_price,
          negotiationId: record.id,
          itemName: record.item_info?.name ?? null,
          currentPrice: record.item_info?.current_price ?? null,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            console.error(
              `Notification API returned ${res.status} ${res.statusText}`
            );
          }
        })
        .catch((err) => console.error('Notification request failed:', err));
    } else {
      console.warn(
        'Skipping push notification: NEXT_PUBLIC_SITE_URL or INTERNAL_API_SECRET not configured'
      );
    }

    return new Response(JSON.stringify({ message: 'Notification sent' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
