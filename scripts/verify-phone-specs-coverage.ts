import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aivqthbxdshhltbwipbr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifySpecs() {
  console.log('=== Phone Spec Coverage Analysis ===\n');

  const brands = ['tecno', 'vivo', 'itel', 'oppo'];

  for (const brand of brands) {
    console.log(`\n--- ${brand.toUpperCase()} ---`);

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, brand, category')
      .ilike('brand', `%${brand}%`)
      .ilike('category', '%phone%')
      .order('name');

    if (error) {
      console.error(`Error fetching ${brand}:`, error);
      continue;
    }

    console.log(`Total ${brand} phones: ${products?.length || 0}`);

    if (!products || products.length === 0) {
      continue;
    }

    let withSpecs = 0;
    let withoutSpecs = 0;
    const missingProducts = [];

    for (const product of products) {
      const { data: specs } = await supabase
        .from('product_key_specs')
        .select('id, screen_size_inches, chipset, ram_gb, battery_mah')
        .eq('product_id', product.id)
        .maybeSingle();

      if (specs) {
        withSpecs++;
      } else {
        withoutSpecs++;
        missingProducts.push(product);
      }
    }

    console.log(`  With specs: ${withSpecs}`);
    console.log(`  Without specs: ${withoutSpecs}`);

    if (missingProducts.length > 0) {
      console.log('\n  Missing specs for:');
      for (const product of missingProducts.slice(0, 5)) {
        console.log(`    - ${product.name} (ID: ${product.id})`);
      }
      if (missingProducts.length > 5) {
        console.log(`    ... and ${missingProducts.length - 5} more`);
      }
    }
  }

  console.log('\n\n=== Summary ===');
  console.log('Checking all target brand phones combined...\n');

  const { data: allTargetProducts } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%phone%')
    .or('brand.ilike.%tecno%,brand.ilike.%vivo%,brand.ilike.%itel%,brand.ilike.%oppo%')
    .order('brand, name');

  if (allTargetProducts) {
    let totalWithSpecs = 0;
    let totalWithoutSpecs = 0;
    const allMissing = [];

    for (const product of allTargetProducts) {
      const { data: specs } = await supabase
        .from('product_key_specs')
        .select('id')
        .eq('product_id', product.id)
        .maybeSingle();

      if (specs) {
        totalWithSpecs++;
      } else {
        totalWithoutSpecs++;
        allMissing.push(product);
      }
    }

    console.log(`Total phones across all brands: ${allTargetProducts.length}`);
    console.log(`With specs: ${totalWithSpecs}`);
    console.log(`Without specs: ${totalWithoutSpecs}`);

    if (allMissing.length > 0) {
      console.log('\n\nProducts to process (up to 15):');
      for (let i = 0; i < Math.min(15, allMissing.length); i++) {
        const product = allMissing[i];
        console.log(`\n${i + 1}. ${product.name}`);
        console.log(`   Brand: ${product.brand}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   Search: "${product.name} specifications gsmarena"`);
      }
    }
  }
}

verifySpecs().catch(console.error);
