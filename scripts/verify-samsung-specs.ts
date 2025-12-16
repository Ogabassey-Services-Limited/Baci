/**
 * Verification script - Check inserted Samsung specs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 Verifying Samsung Phone Specs\n');

  // Get all Samsung phones
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('brand', '%samsung%')
    .ilike('category', '%phone%')
    .limit(20);

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return;
  }

  console.log(`Total Samsung phones in database: ${products?.length || 0}\n`);

  let withSpecs = 0;
  let withoutSpecs = 0;

  for (const product of products || []) {
    const { data: specs, error: specsError } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (specs) {
      withSpecs++;
      console.log(`✅ ${product.name}`);
      console.log(`   Screen: ${specs.screen_size_inches}" ${specs.display_type}`);
      console.log(`   CPU: ${specs.chipset}`);
      console.log(`   RAM/Storage: ${specs.ram_gb}GB / ${specs.storage_gb}GB`);
      console.log(`   Camera: ${specs.main_camera_mp}MP main, ${specs.front_camera_mp}MP front`);
      console.log(`   Battery: ${specs.battery_mah}mAh, ${specs.charging_watt}W charging`);
      console.log(`   5G: ${specs.is_5g ? 'Yes' : 'No'}, NFC: ${specs.has_nfc ? 'Yes' : 'No'}, IP: ${specs.ip_rating || 'N/A'}`);
      console.log('');
    } else {
      withoutSpecs++;
      console.log(`❌ ${product.name} - No specs found`);
    }
  }

  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total Samsung phones: ${products?.length || 0}`);
  console.log(`✅ With specs: ${withSpecs}`);
  console.log(`❌ Without specs: ${withoutSpecs}`);
  console.log(`Coverage: ${((withSpecs / (products?.length || 1)) * 100).toFixed(1)}%`);
}

main().catch(console.error);
