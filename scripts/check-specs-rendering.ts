import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  console.log('=== CHECKING SPECS RENDERING DATA ===\n');

  // Get a sample phone product with specs
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      category,
      product_key_specs (
        screen_size_inches,
        ram_gb,
        storage_gb,
        main_camera_mp,
        battery_mah,
        chipset,
        is_5g
      )
    `)
    .ilike('category', '%phone%')
    .not('product_key_specs', 'is', null)
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Sample Product:', product.name);
  console.log('Category:', product.category);
  console.log('\nKey Specs from DB:');
  console.log(JSON.stringify(product.product_key_specs, null, 2));

  // Count products with specs
  const { count: withSpecs } = await supabase
    .from('product_key_specs')
    .select('id', { count: 'exact', head: true });

  const { count: totalProducts } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true });

  console.log('\n=== COVERAGE ===');
  console.log(`Products with key_specs: ${withSpecs}`);
  console.log(`Total products: ${totalProducts}`);
  console.log(`Coverage: ${((withSpecs || 0) / (totalProducts || 1) * 100).toFixed(1)}%`);
}

check();
