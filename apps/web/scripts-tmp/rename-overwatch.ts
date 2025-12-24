import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function renameOverwatch() {
  console.log('🚀 Renaming Overwatch to Overwatch 2...');

  // 1. Find Overwatch
  const { data: products, error: searchError } = await supabase
    .from('products')
    .select('id, name')
    .ilike('name', '%Overwatch%');

  if (searchError) {
    console.error('❌ Search failed:', searchError.message);
    return;
  }

  if (!products || products.length === 0) {
    console.log('⚠️ No product found matching "Overwatch".');
    return;
  }

  console.log(
    `Found ${products.length} product(s):`,
    products.map((p) => p.name)
  );

  for (const product of products) {
    const lowerName = product.name.toLowerCase();
    if (lowerName.includes('overwatch') && !lowerName.includes('2')) {
      console.log(`   Renaming "${product.name}" -> "Overwatch 2"`);
      const { error: updateError } = await supabase
        .from('products')
        .update({ name: 'Overwatch 2' }) // Simplistic rename, might need to preserve platform suffix if exists
        .eq('id', product.id);

      if (updateError)
        console.error('   ❌ Update failed:', updateError.message);
      else console.log('   ✅ Renamed successfully.');
    } else {
      console.log(
        `   Skipping "${product.name}" (already correct or different title).`
      );
    }
  }
}

renameOverwatch();
