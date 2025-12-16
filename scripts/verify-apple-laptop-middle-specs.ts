import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== Verification: Apple Laptop Middle Batch Specs ===\n');

  // Get products that should have been processed (items 35-49)
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%laptop%')
    .ilike('brand', '%apple%')
    .order('name', { ascending: true });

  // Get all existing spec product IDs
  const { data: existingSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specProductIds = new Set(existingSpecs?.map(s => s.product_id) || []);

  // Filter out products that already have specs
  const productsWithoutSpecs = allProducts?.filter(p => !specProductIds.has(p.id)) || [];

  // Get the batch that was supposed to be processed (items 35-49)
  const batchProducts = allProducts?.slice(35, 50) || [];

  console.log('Checking if all 15 products from the middle batch have specs...\n');

  let allHaveSpecs = true;
  const results = [];

  for (const product of batchProducts) {
    const hasSpecs = specProductIds.has(product.id);
    results.push({
      name: product.name,
      hasSpecs,
      status: hasSpecs ? '✓' : '✗'
    });

    if (!hasSpecs) {
      allHaveSpecs = false;
    }
  }

  // Display results
  for (const result of results) {
    console.log(`${result.status} ${result.name}`);
  }

  console.log(`\n=== VERIFICATION SUMMARY ===`);
  console.log(`Total items in middle batch: ${batchProducts.length}`);
  console.log(`Items with specs: ${results.filter(r => r.hasSpecs).length}`);
  console.log(`Items without specs: ${results.filter(r => !r.hasSpecs).length}`);
  console.log(`Status: ${allHaveSpecs ? 'ALL COMPLETE ✓' : 'INCOMPLETE ✗'}`);

  // Get a sample of inserted specs to verify quality
  if (batchProducts.length > 0) {
    const sampleProductId = batchProducts[0].id;
    const { data: sampleSpec } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', sampleProductId)
      .single();

    if (sampleSpec) {
      console.log(`\n=== SAMPLE SPEC (${batchProducts[0].name}) ===`);
      console.log(JSON.stringify(sampleSpec, null, 2));
    }
  }

  console.log(`\n=== OVERALL PROGRESS ===`);
  console.log(`Total Apple laptops: ${allProducts?.length || 0}`);
  console.log(`Apple laptops with specs: ${(allProducts?.length || 0) - productsWithoutSpecs.length}`);
  console.log(`Apple laptops without specs: ${productsWithoutSpecs.length}`);
  console.log(`Completion rate: ${(((allProducts?.length || 0) - productsWithoutSpecs.length) / (allProducts?.length || 1) * 100).toFixed(1)}%`);
}

main().catch(console.error);
