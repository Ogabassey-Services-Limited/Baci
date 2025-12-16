import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function fixJBL() {
  console.log('=== FIXING JBL PRODUCTS IN PHONE CATEGORY ===\n');

  // Get all JBL products
  const { data: jblProducts } = await supabase
    .from('products')
    .select('id, name, category')
    .ilike('brand', '%jbl%');

  console.log('JBL products found:', jblProducts?.length);

  let fixed = 0;
  for (const p of jblProducts || []) {
    const catLower = p.category?.toLowerCase() || '';
    if (catLower.includes('phone') || catLower.includes('smartphone')) {
      console.log('\nFixing:', p.name);
      console.log('  Current category:', p.category);

      const { error } = await supabase
        .from('products')
        .update({ category: 'Headphones' })
        .eq('id', p.id);

      if (error) {
        console.log('  Error:', error.message);
      } else {
        console.log('  Updated to: Headphones');
        fixed++;
      }
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Fixed ${fixed} JBL products`);
}

fixJBL();
