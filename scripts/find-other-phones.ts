import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aivqthbxdshhltbwipbr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findProducts() {
  console.log('Searching for Tecno, vivo, itel, Oppo phones...\n');

  // First, let's see all products with these brands
  const { data: allProducts, error: allError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('brand.ilike.%tecno%,brand.ilike.%vivo%,brand.ilike.%itel%,brand.ilike.%oppo%')
    .limit(50);

  if (allError) {
    console.error('Error fetching all products:', allError);
    return;
  }

  console.log(`Total products with these brands: ${allProducts?.length || 0}\n`);

  if (allProducts && allProducts.length > 0) {
    console.log('Sample products:');
    for (const product of allProducts.slice(0, 10)) {
      console.log(`- ${product.name} | ${product.brand} | ${product.category}`);
    }
    console.log('');
  }

  // Now check which ones have specs
  const { data: productsWithSpecs, error: specsError } = await supabase
    .from('product_key_specs')
    .select('product_id')
    .in('product_id', allProducts?.map(p => p.id) || []);

  if (specsError) {
    console.error('Error fetching specs:', specsError);
    return;
  }

  const productIdsWithSpecs = new Set(productsWithSpecs?.map(s => s.product_id) || []);
  const productsWithoutSpecs = allProducts?.filter(p => !productIdsWithSpecs.has(p.id)) || [];

  console.log(`Products with specs: ${productIdsWithSpecs.size}`);
  console.log(`Products without specs: ${productsWithoutSpecs.length}\n`);

  if (productsWithoutSpecs.length > 0) {
    console.log('Products without specs (first 15):');
    for (const product of productsWithoutSpecs.slice(0, 15)) {
      console.log(`\nID: ${product.id}`);
      console.log(`Name: ${product.name}`);
      console.log(`Brand: ${product.brand}`);
      console.log(`Category: ${product.category}`);
    }
  }
}

findProducts().catch(console.error);
