import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function checkRemainingPhones() {
  const { data: specs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specIds = new Set(specs?.map(s => s.product_id) || []);

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%phone%');

  const remaining = products?.filter(p => !specIds.has(p.id)) || [];

  console.log('=== REMAINING PHONE-CATEGORY PRODUCTS ===');
  remaining.forEach(p => console.log(`- ${p.brand}: ${p.name} [category: ${p.category}]`));
  console.log(`\nTotal in phone category without specs: ${remaining.length}`);

  // Separate actual phones from non-phones (JBL, headphones, etc.)
  const nonPhones = remaining.filter(p =>
    p.brand?.toLowerCase().includes('jbl') ||
    p.name?.toLowerCase().includes('headphone') ||
    p.name?.toLowerCase().includes('earbuds') ||
    p.name?.toLowerCase().includes('speaker') ||
    p.name?.toLowerCase().includes('tag') ||
    p.name?.toLowerCase().includes('watch') ||
    p.name?.toLowerCase().includes('buds')
  );

  const actualPhones = remaining.filter(p => !nonPhones.includes(p));

  console.log(`\n=== ACTUAL PHONES (need specs) ===`);
  actualPhones.forEach(p => console.log(`- ${p.brand}: ${p.name}`));
  console.log(`Total actual phones: ${actualPhones.length}`);

  console.log(`\n=== MISCATEGORIZED (not phones) ===`);
  nonPhones.forEach(p => console.log(`- ${p.brand}: ${p.name}`));
  console.log(`Total miscategorized: ${nonPhones.length}`);
}

checkRemainingPhones();