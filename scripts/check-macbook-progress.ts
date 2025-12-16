import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .ilike('category', '%laptop%')
    .ilike('brand', '%apple%')
    .order('name', { ascending: false });

  const { data: specs } = await supabase
    .from('product_key_specs')
    .select('product_id')
    .in('product_id', products!.map(p => p.id));

  const specIds = new Set(specs?.map(s => s.product_id) || []);
  const withoutSpecs = products!.filter(p => specIds.has(p.id) === false);

  // Filter for M-series only
  const mSeriesWithoutSpecs = withoutSpecs.filter(p => {
    const lower = p.name.toLowerCase();
    return lower.includes(' m1 ') || lower.includes(' m2 ') || lower.includes(' m3 ') || lower.includes(' m4 ') || lower.includes('air') || lower.match(/m[1-4]\s/);
  });

  console.log('Total Apple laptops:', products!.length);
  console.log('With specs:', specs?.length || 0);
  console.log('Without specs (all):', withoutSpecs.length);
  console.log('Without specs (M-series only):', mSeriesWithoutSpecs.length);

  if (mSeriesWithoutSpecs.length > 0) {
    console.log('\nM-series MacBooks without specs:');
    mSeriesWithoutSpecs.slice(0, 20).forEach(p => console.log('  -', p.name));
  }
}

check();
