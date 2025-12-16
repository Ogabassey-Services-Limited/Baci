import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function checkLinkage() {
  console.log('=== CHECKING PRODUCT-CATEGORY LINKAGE ===\n');

  // 1. Check if products have category_id
  const { data: sample } = await supabase
    .from('products')
    .select('id, name, category, category_id')
    .limit(5);

  console.log('Sample products:');
  for (const p of sample || []) {
    console.log(`  ${p.name.substring(0, 40)}`);
    console.log(`    category (text): ${p.category}`);
    console.log(`    category_id: ${p.category_id || 'NULL'}`);
  }

  // 2. Count products with/without category_id
  const { count: withId } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .not('category_id', 'is', null);

  const { count: withoutId } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .is('category_id', null);

  const { count: total } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true });

  console.log('\n=== LINKAGE STATS ===');
  console.log(`Total products: ${total}`);
  console.log(`With category_id: ${withId}`);
  console.log(`Without category_id: ${withoutId}`);
  console.log(`Coverage: ${((withId || 0) / (total || 1) * 100).toFixed(1)}%`);

  // 3. Check categories table structure
  const { data: cats } = await supabase
    .from('categories')
    .select('*')
    .limit(1);

  console.log('\n=== CATEGORIES TABLE COLUMNS ===');
  if (cats && cats[0]) {
    console.log(Object.keys(cats[0]).join(', '));
  }
}

checkLinkage();
