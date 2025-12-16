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
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id, business_name, slug')
    .eq('slug', 'ogabassey')
    .single();

  if (merchantError) {
    console.log('Merchant error:', merchantError);
    return;
  }
  console.log('Merchant:', merchant);

  // Search for S24 Ultra specifically
  const { data: s24Products, error: s24Error } = await supabase
    .from('products')
    .select('id, name, price, cost_price, status, merchant_id')
    .ilike('name', '%S24%Ultra%');

  console.log('\n--- S24 Ultra Products (any merchant) ---');
  if (s24Error) {
    console.log('Error:', s24Error);
  } else {
    console.log('Found', s24Products?.length, 'S24 Ultra products');
    s24Products?.forEach(p => {
      const matchesMerchant = p.merchant_id === merchant.id ? '✓ MATCH' : '✗ Different merchant';
      console.log(`  - ${p.name}`);
      console.log(`    Status: ${p.status} | Price: ₦${Number(p.price).toLocaleString()} | ${matchesMerchant}`);
    });
  }

  // Check how many active products ogabassey has
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchant.id)
    .eq('status', 'active');

  console.log(`\nOgabassey active products count: ${count}`);

  // Get the top 20 products by price for ogabassey
  const { data: topProducts } = await supabase
    .from('products')
    .select('name, price, status')
    .eq('merchant_id', merchant.id)
    .eq('status', 'active')
    .order('price', { ascending: false })
    .limit(20);

  console.log('\n--- Top 20 Ogabassey Active Products by Price ---');
  topProducts?.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.name} - ₦${Number(p.price).toLocaleString()}`);
  });

  // Also search for Samsung S24 with different patterns
  console.log('\n--- Searching for Samsung S24 variations ---');
  const { data: samsungProducts } = await supabase
    .from('products')
    .select('name, price, status, merchant_id')
    .eq('merchant_id', merchant.id)
    .ilike('name', '%Samsung%S24%');

  console.log('Found', samsungProducts?.length, 'Samsung S24 products for ogabassey');
  samsungProducts?.forEach(p => {
    console.log(`  - ${p.name} | Status: ${p.status} | Price: ₦${Number(p.price).toLocaleString()}`);
  });
}

checkProducts().catch(console.error);
