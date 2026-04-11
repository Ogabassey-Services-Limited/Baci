import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQNLSf8iIWXHWqn_SPYRAr-oGVjZdf8PyEpKQ1P2TwHxNkaZPyfBhl1ncs_Fp_8tFE5mx1A-4e6WQYJ/pub?output=csv';

// ZeptoMail Config
const ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
const ZEPTOMAIL_TOKEN = Deno.env.get('ZEPTOMAIL_TOKEN');
const FROM_EMAIL = 'notifications@usebaci.com';
const FROM_NAME = 'Baci Notifications';
const ADMIN_EMAIL = 'admin@ogabassey.com'; // Configure this

interface NewProduct {
  name: string;
  costPrice: number;
}

interface PriceChange {
  name: string;
  oldPrice: number;
  newPrice: number;
}

interface ExistingProduct {
  id: string;
  external_id: string;
  cost_price: number;
  price: number;
  name: string;
  stock: number | null;
}

interface ProductUpdate {
  id: string;
  cost_price: number;
  price: number;
  last_price_sync: string;
}

serve(async (_req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch CSV
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch CSV');
    const csvText = await response.text();
    const lines = csvText.split('\n').filter((l) => l.trim().length > 0);

    // 2. Fetch Existing Products
    const { data: existingProducts, error: fetchError } = await supabaseClient
      .from('products')
      .select('id, external_id, cost_price, price, name, stock')
      .eq('external_source', 'google_sheet_gaming');

    if (fetchError) throw fetchError;

    const productMap = new Map<string, ExistingProduct>();
    // biome-ignore lint/suspicious/useIterableCallbackReturn: forEach with side effects
    existingProducts?.forEach((p) => productMap.set(p.external_id, p));

    const updates: ProductUpdate[] = [];
    const newProducts: NewProduct[] = [];
    const priceChanges: PriceChange[] = [];

    const startIdx = lines[0].includes('PRICE') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      // Simple CSV parse (robust enough for this sheet)
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

      if (parts.length < 2) continue;

      const rawName = parts[0].trim().replace(/^"|"$/g, '');
      const priceStr = parts[1] ? parts[1].trim().replace(/^"|"$/g, '') : '0';

      if (!rawName || rawName === 'NAME') continue;

      const costPrice = Number.parseFloat(priceStr.replace(/["',]/g, '')) || 0;
      if (costPrice === 0) continue;

      const externalId = rawName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      // Check Existing
      if (productMap.has(externalId)) {
        const existing = productMap.get(externalId);

        if (!existing) {
          continue;
        }

        // Check for significant price difference (> 100 NGN)
        if (Math.abs(existing.cost_price - costPrice) > 100) {
          const newSellingPrice = Math.ceil((costPrice * 1.2) / 100) * 100;

          updates.push({
            id: existing.id,
            cost_price: costPrice,
            price: newSellingPrice,
            last_price_sync: new Date().toISOString(),
          });

          priceChanges.push({
            name: existing.name,
            oldPrice: existing.price,
            newPrice: newSellingPrice,
          });
        }
      } else {
        // New Product
        newProducts.push({
          name: rawName,
          costPrice: costPrice,
        });
      }
    }

    // 3. Batch Update
    if (updates.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('products')
        .upsert(updates);

      if (updateError) throw updateError;
    }

    // 4. Send Notification if needed
    if (newProducts.length > 0 || priceChanges.length > 0) {
      await sendNotification(newProducts, priceChanges); // Implementation below
    }

    return new Response(
      JSON.stringify({
        success: true,
        updates: updates.length,
        new_products: newProducts.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function sendNotification(
  newProducts: NewProduct[],
  priceChanges: PriceChange[]
) {
  if (!ZEPTOMAIL_TOKEN) {
    console.error('Missing ZEPTOMAIL_TOKEN');
    return;
  }

  let htmlBody = '<h2>Weekly Gaming Price Sync Report</h2>';

  if (newProducts.length > 0) {
    htmlBody += `<h3>🚨 ${newProducts.length} New Products Detected</h3>
        <p>These products are in the cost sheet but NOT in the database. Please add them manually or check the import script.</p>
        <ul>
            ${newProducts.map((p) => `<li>${p.name} (Cost: ₦${p.costPrice.toLocaleString()})</li>`).join('')}
        </ul>`;
  }

  if (priceChanges.length > 0) {
    htmlBody += `<h3>💰 ${priceChanges.length} Price Updates</h3>
        <ul>
            ${priceChanges
              .slice(0, 50)
              .map(
                (p) =>
                  `<li><b>${p.name}</b>: ₦${p.oldPrice?.toLocaleString()} ➡️ ₦${p.newPrice.toLocaleString()}</li>`
              )
              .join('')}
            ${priceChanges.length > 50 ? `<li>...and ${priceChanges.length - 50} more</li>` : ''}
        </ul>`;
  }

  const payload = {
    from: { address: FROM_EMAIL, name: FROM_NAME },
    to: [{ email_address: { address: ADMIN_EMAIL, name: 'Admin' } }],
    subject: `[Ogabassey] Gaming Product Updates - ${new Date().toLocaleDateString()}`,
    htmlbody: htmlBody,
  };

  try {
    const res = await fetch(ZEPTOMAIL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ZEPTOMAIL_TOKEN, // Check if valid scheme needed
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('ZeptoMail Error:', txt);
    }
  } catch (e) {
    console.error('Failed to send email:', e);
  }
}
