import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function verify() {
  const { data: allTablets } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%tablet%');

  console.log('Total tablets:', allTablets?.length);

  const tabletsWithoutSpecs = [];
  for (const tablet of allTablets || []) {
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', tablet.id)
      .maybeSingle();

    if (!specs) {
      tabletsWithoutSpecs.push(tablet);
    }
  }

  console.log('Tablets WITHOUT specs:', tabletsWithoutSpecs.length);
  console.log('Tablets WITH specs:', (allTablets?.length || 0) - tabletsWithoutSpecs.length);
  console.log('Coverage:', (((allTablets?.length || 0) - tabletsWithoutSpecs.length) / (allTablets?.length || 1) * 100).toFixed(1) + '%');

  if (tabletsWithoutSpecs.length > 0) {
    console.log('\nMissing specs for:');
    for (const tablet of tabletsWithoutSpecs) {
      console.log(`  - ${tablet.name} (${tablet.brand})`);
    }
  } else {
    console.log('\n✅ All tablets have specs!');
  }
}

verify();
