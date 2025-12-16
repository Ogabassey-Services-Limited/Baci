import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySpecs() {
  console.log('=== Verifying Other Brands Specs ===\n');

  // Query for all specs we just inserted
  const { data: specs, error } = await supabase
    .from('product_key_specs')
    .select(`
      *,
      products (
        name,
        brand
      )
    `)
    .in('product_id', [
      '2d8c1b5f-45bf-4bff-a7a8-27c303cb5193',
      '921d6f79-89e3-4550-b322-d957ef6edfa2',
      '0cef9652-1822-4b47-80b6-627943d1a048',
      'a87c2a7b-0478-4926-9c10-7c11765b46ad',
      'dc914d37-2b64-426d-8225-561d85265a07',
      'c25ef9be-041d-460f-9649-3c92be691b89',
      '8855767c-971a-4bbb-b95c-e111ae09610c',
      '951b32fa-6a80-4bf4-b69a-22b12835c185',
      '018ba498-e827-4aac-ab65-32814aa765c2',
      '2f2c5de7-6c4b-4bfc-b021-a8f1df2fa2df',
      'e5d2d66b-aaef-41eb-b733-83dd038981f2',
      'e136aaf0-0be7-40e2-b0fd-619e9703243b'
    ]);

  if (error) {
    console.error('Error fetching specs:', error);
    return;
  }

  if (!specs || specs.length === 0) {
    console.log('No specs found!');
    return;
  }

  console.log(`Found ${specs.length} specs entries\n`);

  // Group by brand
  const byBrand: Record<string, any[]> = {};

  for (const spec of specs) {
    const brand = (spec as any).products?.brand || 'Unknown';
    if (!byBrand[brand]) {
      byBrand[brand] = [];
    }
    byBrand[brand].push(spec);
  }

  // Display by brand
  for (const [brand, brandSpecs] of Object.entries(byBrand)) {
    console.log(`\n=== ${brand} (${brandSpecs.length} products) ===`);

    for (const spec of brandSpecs) {
      const product = (spec as any).products;
      console.log(`\n📱 ${product?.name || 'Unknown'}`);
      console.log(`   Screen: ${spec.screen_size_inches}" ${spec.display_type} @ ${spec.refresh_rate_hz}Hz`);
      console.log(`   Chipset: ${spec.chipset}`);
      console.log(`   Memory: ${spec.ram_gb}GB RAM / ${spec.storage_gb}GB Storage`);
      console.log(`   Camera: ${spec.main_camera_mp}MP main, ${spec.front_camera_mp}MP front`);
      console.log(`   Battery: ${spec.battery_mah}mAh with ${spec.charging_watt}W charging`);
      console.log(`   Connectivity: ${spec.is_5g ? '5G' : '4G'}${spec.has_nfc ? ', NFC' : ''}`);
      console.log(`   Weight: ${spec.weight_g}g`);
      const colors = Array.isArray(spec.available_colors)
        ? spec.available_colors.join(', ')
        : spec.available_colors
          ? JSON.stringify(spec.available_colors)
          : 'N/A';
      console.log(`   Colors: ${colors}`);
    }
  }

  // Summary statistics
  console.log('\n\n=== Summary Statistics ===');
  console.log(`Total products with specs: ${specs.length}`);

  const with5G = specs.filter(s => s.is_5g).length;
  const withNFC = specs.filter(s => s.has_nfc).length;
  const avgBattery = Math.round(specs.reduce((sum, s) => sum + (s.battery_mah || 0), 0) / specs.length);
  const avgScreen = (specs.reduce((sum, s) => sum + (s.screen_size_inches || 0), 0) / specs.length).toFixed(2);

  console.log(`5G enabled: ${with5G} (${Math.round(with5G / specs.length * 100)}%)`);
  console.log(`NFC enabled: ${withNFC} (${Math.round(withNFC / specs.length * 100)}%)`);
  console.log(`Average battery: ${avgBattery}mAh`);
  console.log(`Average screen size: ${avgScreen}"`);

  console.log('\nBrands covered:');
  for (const [brand, brandSpecs] of Object.entries(byBrand)) {
    console.log(`  - ${brand}: ${brandSpecs.length} products`);
  }
}

verifySpecs().catch(console.error);
