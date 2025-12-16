import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function auditAudioSpecs() {
  console.log('=== Complete Audio Product Spec Audit ===\n');

  const { data: allAudio } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('category.ilike.%audio%,category.ilike.%earbud%,category.ilike.%headphone%')
    .order('brand, name');

  console.log(`Total audio products: ${allAudio?.length || 0}\n`);

  let withCompleteSpecs = 0;
  let withPartialSpecs = 0;
  let withoutSpecs = 0;

  const productsByBrand: Record<string, number> = {};
  const specQuality: Record<string, any> = {
    hasBluetooth: 0,
    hasBattery: 0,
    hasWeight: 0,
    hasIPRating: 0,
    hasWirelessCharging: 0,
    hasSensors: 0,
    hasColors: 0,
  };

  console.log('=== All Audio Products with Specs ===\n');

  for (const product of allAudio || []) {
    // Count by brand
    const brand = product.brand || 'Unknown';
    productsByBrand[brand] = (productsByBrand[brand] || 0) + 1;

    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .maybeSingle();

    if (!spec) {
      withoutSpecs++;
      console.log(`❌ ${product.name} (${product.brand}) - NO SPECS`);
      continue;
    }

    // Count field coverage
    let fieldsPopulated = 0;
    const totalFields = 7;

    if (spec.bluetooth_version) {
      fieldsPopulated++;
      specQuality.hasBluetooth++;
    }
    if (spec.battery_mah) {
      fieldsPopulated++;
      specQuality.hasBattery++;
    }
    if (spec.weight_g) {
      fieldsPopulated++;
      specQuality.hasWeight++;
    }
    if (spec.ip_rating) {
      fieldsPopulated++;
      specQuality.hasIPRating++;
    }
    if (spec.has_wireless_charging !== null) {
      fieldsPopulated++;
      specQuality.hasWirelessCharging++;
    }
    if (spec.sensors) {
      fieldsPopulated++;
      specQuality.hasSensors++;
    }
    if (spec.available_colors) {
      fieldsPopulated++;
      specQuality.hasColors++;
    }

    const completeness = (fieldsPopulated / totalFields) * 100;

    if (completeness >= 70) {
      withCompleteSpecs++;
      console.log(`✓ ${product.name} (${product.brand}) - ${completeness.toFixed(0)}% complete`);
    } else {
      withPartialSpecs++;
      console.log(`⚠ ${product.name} (${product.brand}) - ${completeness.toFixed(0)}% complete (partial)`);
    }

    // Show key specs inline
    console.log(`  BT: ${spec.bluetooth_version || 'N/A'} | Battery: ${spec.battery_mah || 'N/A'}mAh | Weight: ${spec.weight_g || 'N/A'}g | IP: ${spec.ip_rating || 'N/A'}`);
  }

  console.log('\n\n=== Summary Statistics ===\n');
  console.log(`Total products: ${allAudio?.length || 0}`);
  console.log(`Complete specs (≥70%): ${withCompleteSpecs}`);
  console.log(`Partial specs (<70%): ${withPartialSpecs}`);
  console.log(`No specs: ${withoutSpecs}`);
  console.log(`Coverage: ${(((withCompleteSpecs + withPartialSpecs) / (allAudio?.length || 1)) * 100).toFixed(1)}%\n`);

  console.log('=== Field Coverage ===\n');
  const total = allAudio?.length || 1;
  console.log(`Bluetooth Version: ${specQuality.hasBluetooth}/${total} (${((specQuality.hasBluetooth / total) * 100).toFixed(1)}%)`);
  console.log(`Battery: ${specQuality.hasBattery}/${total} (${((specQuality.hasBattery / total) * 100).toFixed(1)}%)`);
  console.log(`Weight: ${specQuality.hasWeight}/${total} (${((specQuality.hasWeight / total) * 100).toFixed(1)}%)`);
  console.log(`IP Rating: ${specQuality.hasIPRating}/${total} (${((specQuality.hasIPRating / total) * 100).toFixed(1)}%)`);
  console.log(`Wireless Charging: ${specQuality.hasWirelessCharging}/${total} (${((specQuality.hasWirelessCharging / total) * 100).toFixed(1)}%)`);
  console.log(`Sensors: ${specQuality.hasSensors}/${total} (${((specQuality.hasSensors / total) * 100).toFixed(1)}%)`);
  console.log(`Colors: ${specQuality.hasColors}/${total} (${((specQuality.hasColors / total) * 100).toFixed(1)}%)`);

  console.log('\n=== Products by Brand ===\n');
  const sortedBrands = Object.entries(productsByBrand).sort((a, b) => b[1] - a[1]);
  for (const [brand, count] of sortedBrands) {
    console.log(`${brand}: ${count} products`);
  }
}

auditAudioSpecs().catch(console.error);
