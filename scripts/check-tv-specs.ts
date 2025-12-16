/**
 * Check TV products and product_key_specs schema
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
  console.log('🔍 Checking TV Products and Schema\n');

  // Get all TV products without specs
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

  // Check which ones have specs
  let withSpecs = 0;
  let withoutSpecs = 0;
  const missingSpecs: any[] = [];

  for (const product of products || []) {
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .single();

    if (specs) {
      withSpecs++;
      console.log(`✅ ${product.brand} - ${product.name}`);
    } else {
      withoutSpecs++;
      missingSpecs.push(product);
      console.log(`❌ ${product.brand} - ${product.name}`);
    }
  }

  console.log('\n📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total TVs: ${products?.length || 0}`);
  console.log(`✅ With specs: ${withSpecs}`);
  console.log(`❌ Without specs: ${withoutSpecs}`);

  // Check one spec entry to see columns
  console.log('\n🔍 Checking existing product_key_specs columns...\n');
  const { data: sampleSpecs } = await supabase
    .from('product_key_specs')
    .select('*')
    .limit(1)
    .single();

  if (sampleSpecs) {
    console.log('Available columns:', Object.keys(sampleSpecs).join(', '));
  }

  // List products that need specs
  if (missingSpecs.length > 0) {
    console.log('\n📝 Products needing specs:');
    console.log('='.repeat(50));
    missingSpecs.forEach(p => {
      console.log(`ID: ${p.id}`);
      console.log(`Brand: ${p.brand}`);
      console.log(`Name: ${p.name}`);
      console.log(`Category: ${p.category}`);
      console.log('---');
    });
  }
}

main().catch(console.error);
