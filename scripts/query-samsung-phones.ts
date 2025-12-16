import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function query() {
  console.log('Querying Samsung phones...\n');

  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('brand', '%samsung%')
    .ilike('category', '%phone%')
    .limit(20);

  if (error) {
    console.error('Database error:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} Samsung phones\n`);

  for (const product of data || []) {
    // Check if specs exist
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .single();

    console.log(`${product.name}`);
    console.log(`  ID: ${product.id}`);
    console.log(`  Has specs: ${specs ? 'YES' : 'NO'}`);
    console.log('');
  }
}

query();
