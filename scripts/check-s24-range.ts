import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
  // First find the merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', 'ogabassey')
    .single();

  if (!merchant?.id) {
    console.log('Merchant not found');
    return;
  }

  // Check specifically for S24 Ultra
  const { data: s24UltraProducts } = await supabase
    .from('products')
    .select('name, price, status')
    .eq('merchant_id', merchant.id)
    .ilike('name', '%S24 Ultra%');

  console.log('S24 Ultra products (any status):');
  s24UltraProducts?.forEach(p => {
    console.log(`  - ${p.name} | ₦${Number(p.price).toLocaleString()} | Status: ${p.status}`);
  });

  // Count products in 800K-2M range
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchant.id)
    .eq('status', 'active')
    .gte('price', 800000)
    .lt('price', 2000000);

  console.log(`\nTotal active products in ₦800K-2M range: ${count}`);

  // Check where S24 Ultra falls in the ordering
  const { data: allInRange } = await supabase
    .from('products')
    .select('name, price')
    .eq('merchant_id', merchant.id)
    .eq('status', 'active')
    .gte('price', 800000)
    .lt('price', 2000000)
    .order('price', { ascending: false });

  const s24Index = allInRange?.findIndex(p => p.name.toLowerCase().includes('s24 ultra'));
  console.log(`\nS24 Ultra position in ₦800K-2M range: ${s24Index !== undefined && s24Index >= 0 ? `#${s24Index + 1} out of ${allInRange?.length}` : 'NOT FOUND'}`);

  if (s24Index !== undefined && s24Index >= 0 && allInRange) {
    console.log(`\nProducts around S24 Ultra:`);
    for (let i = Math.max(0, s24Index - 2); i <= Math.min(allInRange.length - 1, s24Index + 2); i++) {
      const marker = i === s24Index ? '>>> ' : '    ';
      console.log(`${marker}#${i + 1}: ${allInRange[i].name} - ₦${Number(allInRange[i].price).toLocaleString()}`);
    }
  }
}

checkProducts().catch(console.error);
