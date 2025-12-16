import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  // Check current coverage
  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'archived');

  const { count: specsCount } = await supabase
    .from('product_key_specs')
    .select('*', { count: 'exact', head: true });

  // Get breakdown by category
  const { data: phones } = await supabase
    .from('products')
    .select('id')
    .ilike('category', '%phone%')
    .neq('status', 'archived');

  const { data: laptops } = await supabase
    .from('products')
    .select('id')
    .ilike('category', '%laptop%')
    .neq('status', 'archived');

  // Get phones without specs using a different approach
  const { data: existingSpecIds } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specProductIds = existingSpecIds?.map(s => s.product_id) || [];

  let phonesQuery = supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%phone%')
    .neq('status', 'archived');

  if (specProductIds.length > 0) {
    phonesQuery = phonesQuery.not('id', 'in', `(${specProductIds.join(',')})`);
  }

  const { data: phonesWithoutSpecs } = await phonesQuery.limit(10);

  console.log('=== CURRENT STATUS ===');
  console.log('Total Products:', totalProducts);
  console.log('Products with Specs:', specsCount);
  console.log('Coverage:', ((specsCount || 0) / (totalProducts || 1) * 100).toFixed(1) + '%');
  console.log('');
  console.log('=== BY CATEGORY ===');
  console.log('Phones:', phones?.length || 0);
  console.log('Laptops:', laptops?.length || 0);
  console.log('');
  console.log('=== SAMPLE PHONES WITHOUT SPECS ===');
  phonesWithoutSpecs?.slice(0, 5).forEach(p => {
    console.log(`- ${p.brand}: ${p.name}`);
  });
}

main().catch(console.error);