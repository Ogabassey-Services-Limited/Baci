import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  // Get all products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .neq('status', 'archived');

  // Get existing specs
  const { data: specs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specIds = new Set(specs?.map(s => s.product_id) || []);
  const remaining = products?.filter(p => !specIds.has(p.id)) || [];

  // Count by brand + category
  const counts: Record<string, number> = {};
  remaining.forEach(p => {
    const cat = p.category?.toLowerCase().includes('phone') ? 'phones'
              : p.category?.toLowerCase().includes('laptop') ? 'laptops'
              : 'other';
    const key = `${p.brand} (${cat})`;
    counts[key] = (counts[key] || 0) + 1;
  });

  console.log('=== REMAINING PRODUCTS BY BRAND ===\n');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([k, v]) => console.log(`${k}: ${v}`));

  console.log('\n=== TOTAL REMAINING ===');
  console.log(`Phones: ${remaining.filter(p => p.category?.toLowerCase().includes('phone')).length}`);
  console.log(`Laptops: ${remaining.filter(p => p.category?.toLowerCase().includes('laptop')).length}`);
  console.log(`Other: ${remaining.filter(p => !p.category?.toLowerCase().includes('phone') && !p.category?.toLowerCase().includes('laptop')).length}`);
  console.log(`TOTAL: ${remaining.length}`);
}

main().catch(console.error);
