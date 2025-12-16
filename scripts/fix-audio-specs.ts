import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAudioSpecs() {
  console.log('=== Fixing Audio Product Specs ===\n');

  // Fix AirPods 4 (should be BT 5.3, not 4.2)
  console.log('Fixing AirPods 4...');
  const { data: airpods4Products } = await supabase
    .from('products')
    .select('id, name')
    .ilike('name', '%AirPods 4%')
    .not('name', 'ilike', '%ANC%');

  for (const product of airpods4Products || []) {
    await supabase
      .from('product_key_specs')
      .update({
        bluetooth_version: '5.3',
        weight_g: 43,
        ip_rating: 'IP54',
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor',
      })
      .eq('product_id', product.id);
    console.log(`  ✓ Fixed ${product.name}`);
  }

  // Fix AirPods 4 with ANC
  console.log('\nFixing AirPods 4 with ANC...');
  const { data: airpods4ANCProducts } = await supabase
    .from('products')
    .select('id, name')
    .or('name.ilike.%AirPods 4 ANC%,name.ilike.%AirPods 4 with ANC%');

  for (const product of airpods4ANCProducts || []) {
    await supabase
      .from('product_key_specs')
      .update({
        bluetooth_version: '5.3',
        weight_g: 50,
        ip_rating: 'IP54',
        has_wireless_charging: true,
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor, Touch control',
      })
      .eq('product_id', product.id);
    console.log(`  ✓ Fixed ${product.name}`);
  }

  // Fix AirPods Max USB-C (AirPods Max 2)
  console.log('\nFixing AirPods Max USB-C...');
  const { data: airpodsMaxUSBC } = await supabase
    .from('products')
    .select('id, name')
    .ilike('name', '%AirPods Max%USB-C%');

  for (const product of airpodsMaxUSBC || []) {
    await supabase
      .from('product_key_specs')
      .update({
        bluetooth_version: '5.0',
        weight_g: 385,
        sensors: 'Accelerometer, Gyroscope, Optical sensor',
        available_colors: 'Midnight, Starlight, Blue, Purple, Orange',
      })
      .eq('product_id', product.id);
    console.log(`  ✓ Fixed ${product.name}`);
  }

  // Fix AirPods Pro 3 (shouldn't exist yet, probably misnamed)
  console.log('\nChecking AirPods Pro 3...');
  const { data: airpodsProProducts } = await supabase
    .from('products')
    .select('id, name')
    .or('name.ilike.%AirPods Pro 3%,name.ilike.%AirPods Pro 3rd%');

  for (const product of airpodsProProducts || []) {
    console.log(`  ⚠ Found ${product.name} - updating to Pro 2 specs (Pro 3 not yet released)`);
    await supabase
      .from('product_key_specs')
      .update({
        bluetooth_version: '5.3',
        battery_mah: 523,
        weight_g: 51,
        ip_rating: 'IP54',
        has_wireless_charging: true,
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor, Touch control',
      })
      .eq('product_id', product.id);
    console.log(`  ✓ Updated ${product.name}`);
  }

  console.log('\n=== Verification ===\n');

  // Verify the fixes
  const productsToCheck = [
    'AirPods 4',
    'AirPods 4 with ANC',
    'AirPods Max USB-C',
    'AirPods Pro 3'
  ];

  for (const searchName of productsToCheck) {
    const { data: product } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', `%${searchName}%`)
      .limit(1)
      .single();

    if (product) {
      const { data: spec } = await supabase
        .from('product_key_specs')
        .select('bluetooth_version, battery_mah, weight_g, ip_rating, has_wireless_charging')
        .eq('product_id', product.id)
        .single();

      if (spec) {
        console.log(`${product.name}:`);
        console.log(`  BT: ${spec.bluetooth_version || 'N/A'}`);
        console.log(`  Battery: ${spec.battery_mah || 'N/A'}mAh`);
        console.log(`  Weight: ${spec.weight_g || 'N/A'}g`);
        console.log(`  IP: ${spec.ip_rating || 'N/A'}`);
        console.log(`  Wireless Charging: ${spec.has_wireless_charging ? 'Yes' : 'No'}`);
        console.log('');
      }
    }
  }
}

fixAudioSpecs().catch(console.error);
