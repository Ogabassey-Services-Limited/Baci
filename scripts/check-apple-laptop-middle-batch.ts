import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Query all Apple laptops
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%laptop%')
    .ilike('brand', '%apple%')
    .order('name', { ascending: true });

  console.log(`Total Apple laptops: ${allProducts?.length || 0}`);

  // Get all existing spec product IDs
  const { data: existingSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specProductIds = new Set(existingSpecs?.map(s => s.product_id) || []);

  // Filter out products that already have specs
  const productsWithoutSpecs = allProducts?.filter(p => !specProductIds.has(p.id)) || [];

  console.log(`Apple laptops without specs: ${productsWithoutSpecs.length}\n`);

  // Show items 0-80
  console.log('Items 0-80:');
  for (let i = 0; i < Math.min(80, productsWithoutSpecs.length); i++) {
    console.log(`[${i}] ${productsWithoutSpecs[i].name}`);
  }
}

main().catch(console.error);
