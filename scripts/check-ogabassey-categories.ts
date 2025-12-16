import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  console.log('=== CHECKING PRODUCTS TABLE SCHEMA ===\n');

  // 0. Check products columns
  const { data: sample } = await supabase
    .from('products')
    .select('*')
    .limit(1)
    .single();

  if (sample) {
    const cols = Object.keys(sample).sort();
    console.log('Category-related columns:');
    for (const col of cols) {
      if (col.toLowerCase().includes('category')) {
        console.log('  >>> ' + col);
      }
    }
    console.log('');
  }

  // 1. Get OgaBassey merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name')
    .ilike('business_name', '%ogabassey%')
    .single();

  if (!merchant) {
    console.log('OgaBassey merchant not found');
    return;
  }

  console.log(`Merchant: ${merchant.business_name} (${merchant.id})\n`);

  // 2. Check OgaBassey's categories
  const { data: cats } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .eq('merchant_id', merchant.id)
    .order('display_order');

  console.log('=== OGABASSEY CATEGORIES ===');
  const roots = cats?.filter(c => !c.parent_id) || [];
  for (const root of roots) {
    console.log(`📁 ${root.name} (${root.slug})`);
    const children = cats?.filter(c => c.parent_id === root.id) || [];
    for (const child of children) {
      console.log(`   └── ${child.name} (${child.slug})`);
    }
  }

  // 3. Check product category TEXT values
  const { data: products } = await supabase
    .from('products')
    .select('category')
    .eq('merchant_id', merchant.id);

  const catCounts = new Map<string, number>();
  for (const p of products || []) {
    const cat = p.category || 'NULL';
    catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
  }

  console.log('\n=== PRODUCT CATEGORY TEXT VALUES ===');
  const sorted = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`  ${cat}: ${count}`);
  }

  // 4. Check if there's a mismatch
  console.log('\n=== ANALYSIS ===');
  const catSlugs = new Set(cats?.map(c => c.slug.toLowerCase()) || []);
  const productCats = new Set([...catCounts.keys()].map(c => c.toLowerCase()));

  const inCatsNotProducts = [...catSlugs].filter(s => !productCats.has(s));
  const inProductsNotCats = [...productCats].filter(s => !catSlugs.has(s));

  if (inProductsNotCats.length > 0) {
    console.log('Product categories NOT in categories table:');
    for (const c of inProductsNotCats.slice(0, 10)) {
      console.log(`  - ${c}`);
    }
  }
}

check();
