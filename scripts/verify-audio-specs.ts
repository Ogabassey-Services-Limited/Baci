import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAudioSpecs() {
  console.log('=== Audio Product Spec Verification ===\n');

  // Check total audio products
  const { data: allAudio } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('category.ilike.%audio%,category.ilike.%earbud%,category.ilike.%headphone%')
    .order('name');

  console.log(`Total audio products: ${allAudio?.length || 0}\n`);

  // Check how many have specs
  let withSpecs = 0;
  let withoutSpecs = 0;
  const missing = [];

  for (const product of allAudio || []) {
    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .maybeSingle();

    if (spec) {
      withSpecs++;
    } else {
      withoutSpecs++;
      missing.push(product);
    }
  }

  console.log(`With specs: ${withSpecs}`);
  console.log(`Without specs: ${withoutSpecs}\n`);

  if (missing.length > 0) {
    console.log('Products missing specs:');
    for (const product of missing) {
      console.log(`  - ${product.name} (${product.brand})`);
    }
    console.log('');
  }

  // Show detailed view of first 10 products with specs
  console.log('=== Sample Products with Specs ===\n');
  let count = 0;
  for (const product of allAudio || []) {
    if (count >= 10) break;

    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('bluetooth_version, battery_mah, weight_g, ip_rating, has_wireless_charging, sensors, available_colors')
      .eq('product_id', product.id)
      .maybeSingle();

    if (spec) {
      console.log(`${count + 1}. ${product.name} (${product.brand})`);
      console.log(`   Bluetooth: ${spec.bluetooth_version || 'N/A'}`);
      console.log(`   Battery: ${spec.battery_mah || 'N/A'}mAh`);
      console.log(`   Weight: ${spec.weight_g || 'N/A'}g`);
      console.log(`   IP Rating: ${spec.ip_rating || 'N/A'}`);
      console.log(`   Wireless Charging: ${spec.has_wireless_charging ? 'Yes' : 'No'}`);
      console.log(`   Sensors: ${spec.sensors || 'N/A'}`);
      console.log(`   Colors: ${spec.available_colors || 'N/A'}`);
      console.log('');
      count++;
    }
  }

  // Statistics
  console.log('=== Statistics ===');
  console.log(`Coverage: ${((withSpecs / (allAudio?.length || 1)) * 100).toFixed(1)}%`);
  console.log(`Complete: ${withSpecs}/${allAudio?.length || 0}`);
}

verifyAudioSpecs().catch(console.error);
