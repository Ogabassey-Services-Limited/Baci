/**
 * Verify TV specs have been properly inserted
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 Verifying TV Specs\n');

  // Get all TV products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%tv%')
    .order('brand', { ascending: true })
    .order('name', { ascending: true });

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return;
  }

  console.log(`Total TV products: ${products?.length || 0}\n`);

  let withSpecs = 0;
  let withoutSpecs = 0;
  const specsByType: { [key: string]: number } = {};
  const specsByResolution: { [key: string]: number } = {};

  for (const product of products || []) {
    const { data: specs, error: specsError } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (specs) {
      withSpecs++;
      console.log(`✅ ${product.brand} - ${product.name}`);
      console.log(`   Screen: ${specs.screen_size_inches}" ${specs.display_type}`);
      console.log(`   Resolution: ${specs.display_resolution}`);
      console.log(`   Refresh Rate: ${specs.refresh_rate_hz}Hz\n`);

      // Track statistics
      specsByType[specs.display_type] = (specsByType[specs.display_type] || 0) + 1;
      specsByResolution[specs.display_resolution] = (specsByResolution[specs.display_resolution] || 0) + 1;
    } else {
      withoutSpecs++;
      console.log(`❌ ${product.brand} - ${product.name} - No specs found\n`);
    }
  }

  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total TVs: ${products?.length || 0}`);
  console.log(`✅ With specs: ${withSpecs}`);
  console.log(`❌ Without specs: ${withoutSpecs}`);
  console.log(`Coverage: ${((withSpecs / (products?.length || 1)) * 100).toFixed(1)}%\n`);

  console.log('📺 Display Types:');
  Object.entries(specsByType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  console.log('\n📐 Resolutions:');
  Object.entries(specsByResolution).sort((a, b) => b[1] - a[1]).forEach(([resolution, count]) => {
    console.log(`   ${resolution}: ${count}`);
  });

  // Sample a few specs to show details
  console.log('\n🔍 Sample TV Specs:');
  console.log('='.repeat(50));

  const sampleBrands = ['Samsung', 'LG'];
  for (const brand of sampleBrands) {
    const { data: brandProduct } = await supabase
      .from('products')
      .select('id, name, brand')
      .ilike('category', '%tv%')
      .ilike('brand', brand)
      .limit(1)
      .single();

    if (brandProduct) {
      const { data: specs } = await supabase
        .from('product_key_specs')
        .select('*')
        .eq('product_id', brandProduct.id)
        .single();

      if (specs) {
        console.log(`\n${brandProduct.brand} - ${brandProduct.name}:`);
        console.log(`  Product ID: ${specs.product_id}`);
        console.log(`  Screen Size: ${specs.screen_size_inches}"`);
        console.log(`  Display Type: ${specs.display_type}`);
        console.log(`  Resolution: ${specs.display_resolution}`);
        console.log(`  Refresh Rate: ${specs.refresh_rate_hz}Hz`);
      }
    }
  }
}

main().catch(console.error);
