import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRemaining() {
  console.log('=== Checking Remaining Products Without Specs ===\n');

  const brands = ['infinix', 'tecno', 'vivo', 'itel', 'oppo'];

  for (const brand of brands) {
    console.log(`\n--- ${brand.toUpperCase()} ---`);

    // Get all products of this brand in phone category
    const { data: allProducts, error: allError } = await supabase
      .from('products')
      .select('id, name, brand')
      .ilike('category', '%phone%')
      .ilike('brand', `%${brand}%`);

    if (allError) {
      console.error(`Error fetching ${brand} products:`, allError);
      continue;
    }

    console.log(`Total ${brand} phones in database: ${allProducts?.length || 0}`);

    if (!allProducts || allProducts.length === 0) {
      continue;
    }

    // Check which ones have specs
    const productIds = allProducts.map(p => p.id);

    const { data: withSpecs, error: specsError } = await supabase
      .from('product_key_specs')
      .select('product_id')
      .in('product_id', productIds);

    if (specsError) {
      console.error(`Error fetching specs:`, specsError);
      continue;
    }

    const specsIds = new Set(withSpecs?.map(s => s.product_id) || []);
    const withoutSpecs = allProducts.filter(p => !specsIds.has(p.id));

    console.log(`Products with specs: ${specsIds.size}`);
    console.log(`Products without specs: ${withoutSpecs.length}`);

    if (withoutSpecs.length > 0) {
      console.log('\nProducts still needing specs:');
      withoutSpecs.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} (${p.id})`);
      });
    }
  }

  // Overall summary
  console.log('\n\n=== Overall Summary ===');

  const { data: totalProducts } = await supabase
    .from('products')
    .select('id')
    .ilike('category', '%phone%')
    .or('brand.ilike.%infinix%,brand.ilike.%tecno%,brand.ilike.%vivo%,brand.ilike.%itel%,brand.ilike.%oppo%');

  const { data: totalSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id')
    .in('product_id', totalProducts?.map(p => p.id) || []);

  console.log(`Total phones from these brands: ${totalProducts?.length || 0}`);
  console.log(`Total with specs: ${totalSpecs?.length || 0}`);
  console.log(`Total without specs: ${(totalProducts?.length || 0) - (totalSpecs?.length || 0)}`);
  console.log(`Completion rate: ${Math.round(((totalSpecs?.length || 0) / (totalProducts?.length || 0)) * 100)}%`);
}

checkRemaining().catch(console.error);
