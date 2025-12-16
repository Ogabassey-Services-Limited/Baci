import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aivqthbxdshhltbwipbr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdnF0aGJ4ZHNoaGx0YndpcGJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjA1MTQ4MywiZXhwIjoyMDc3NjI3NDgzfQ.iw7-qPz0WKV0d7N_GcW67-2jEajp8LfZ2pZebSYmmoU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('APPLE PHONE SPEC VERIFICATION REPORT');
  console.log('=====================================\n');

  // Get all Apple phones
  const { data: allProducts, error: allError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%')
    .order('name', { ascending: true });

  if (allError) {
    console.error('Error:', allError);
    return;
  }

  console.log(`Total Apple products in phone category: ${allProducts?.length || 0}`);

  // Get products with specs
  const { data: productsWithSpecs, error: specsError } = await supabase
    .from('products')
    .select(`
      id,
      name,
      product_key_specs (
        screen_size_inches,
        chipset,
        ram_gb,
        storage_gb,
        battery_mah
      )
    `)
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%')
    .not('product_key_specs', 'is', null);

  if (specsError) {
    console.error('Error:', specsError);
    return;
  }

  console.log(`Products WITH specs: ${productsWithSpecs?.length || 0}`);

  // Get products without specs
  const { data: existingSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const existingProductIds = new Set(existingSpecs?.map(s => s.product_id) || []);
  const productsWithoutSpecs = (allProducts || []).filter(p => !existingProductIds.has(p.id));

  console.log(`Products WITHOUT specs: ${productsWithoutSpecs.length}`);

  if (productsWithoutSpecs.length > 0) {
    console.log('\nProducts missing specs:');
    productsWithoutSpecs.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name} (ID: ${p.id})`);
    });
  } else {
    console.log('\n✓ ALL APPLE PRODUCTS HAVE SPECS!');
  }

  // Sample some specs to verify data quality
  console.log('\n--- Sample Specs (First 5) ---');
  const sampleProducts = productsWithSpecs?.slice(0, 5) || [];

  for (const product of sampleProducts) {
    const specs = Array.isArray(product.product_key_specs)
      ? product.product_key_specs[0]
      : product.product_key_specs;

    console.log(`\n${product.name}:`);
    if (specs) {
      console.log(`  Screen: ${specs.screen_size_inches || 'N/A'}" | Chipset: ${specs.chipset || 'N/A'}`);
      console.log(`  RAM: ${specs.ram_gb || 'N/A'}GB | Storage: ${specs.storage_gb || 'N/A'}GB | Battery: ${specs.battery_mah || 'N/A'}mAh`);
    } else {
      console.log('  No specs data');
    }
  }

  console.log('\n=====================================');
  console.log('✓ Verification complete!');
}

main().catch(console.error);
