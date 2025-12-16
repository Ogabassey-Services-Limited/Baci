import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function showSamples() {
  const brands = ['Apple', 'Samsung', 'Xiaomi', 'Tecno'];

  console.log('=== Sample Tablet Specs by Brand ===\n');

  for (const brand of brands) {
    console.log(`${brand}:`);
    const { data: tablets } = await supabase
      .from('products')
      .select('name, product_key_specs(screen_size_inches, chipset, ram_gb, battery_mah, is_5g)')
      .ilike('category', '%tablet%')
      .ilike('brand', `%${brand}%`)
      .limit(3);

    tablets?.forEach(t => {
      const s = t.product_key_specs as any;
      if (s) {
        console.log(`  - ${t.name}`);
        console.log(`    ${s.screen_size_inches}" | ${s.chipset} | ${s.ram_gb}GB | ${s.battery_mah}mAh | 5G: ${s.is_5g}`);
      }
    });
    console.log('');
  }
}

showSamples();
