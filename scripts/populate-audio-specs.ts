import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AudioSpec {
  product_id: string;
  bluetooth_version?: string;
  has_nfc?: boolean;
  battery_mah?: number;
  charging_watt?: number;
  weight_g?: number;
  ip_rating?: string;
  has_wireless_charging?: boolean;
  sensors?: string;
  available_colors?: string;
}

async function populateAudioSpecs() {
  console.log('=== Audio Product Specs Population ===\n');

  // Step 1: Find audio products without specs
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('category.ilike.%audio%,category.ilike.%earbud%,category.ilike.%headphone%')
    .order('name');

  if (fetchError) {
    console.error('Error fetching products:', fetchError);
    return;
  }

  if (!products || products.length === 0) {
    console.log('No audio products found');
    return;
  }

  console.log(`Found ${products.length} audio products\n`);

  // Step 2: Filter products that don't have specs yet
  const productsNeedingSpecs = [];
  for (const product of products) {
    const { data: existingSpec } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .maybeSingle();

    if (!existingSpec) {
      productsNeedingSpecs.push(product);
    }
  }

  console.log(`${productsNeedingSpecs.length} products need specs\n`);

  if (productsNeedingSpecs.length === 0) {
    console.log('All products already have specs!');
    return;
  }

  // Step 3: Populate specs for each product
  const specsToInsert: AudioSpec[] = [];

  for (const product of productsNeedingSpecs) {
    console.log(`\nResearching: ${product.name} (${product.brand})`);

    const spec = await researchAudioProduct(product.name, product.brand);
    if (spec) {
      specsToInsert.push({
        product_id: product.id,
        ...spec
      });
      console.log(`  ✓ Spec created`);
    } else {
      console.log(`  ✗ Could not find specs`);
    }
  }

  // Step 4: Batch insert specs
  if (specsToInsert.length > 0) {
    console.log(`\n\nInserting ${specsToInsert.length} specs...`);

    const { data, error } = await supabase
      .from('product_key_specs')
      .upsert(specsToInsert, { onConflict: 'product_id' });

    if (error) {
      console.error('Error inserting specs:', error);
    } else {
      console.log(`✓ Successfully inserted ${specsToInsert.length} specs`);
    }
  }

  // Step 5: Verify results
  console.log('\n\n=== Verification ===');
  for (const product of productsNeedingSpecs) {
    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('bluetooth_version, battery_mah, weight_g, ip_rating')
      .eq('product_id', product.id)
      .maybeSingle();

    if (spec) {
      console.log(`✓ ${product.name}`);
      console.log(`  BT: ${spec.bluetooth_version || 'N/A'}, Battery: ${spec.battery_mah || 'N/A'}mAh, Weight: ${spec.weight_g || 'N/A'}g, IP: ${spec.ip_rating || 'N/A'}`);
    } else {
      console.log(`✗ ${product.name} - No spec found`);
    }
  }
}

async function researchAudioProduct(name: string, brand: string): Promise<Omit<AudioSpec, 'product_id'> | null> {
  // Normalize product name for matching
  const normalizedName = name.toLowerCase();
  const normalizedBrand = brand.toLowerCase();

  // Apple AirPods Database
  if (normalizedBrand.includes('apple')) {
    // AirPods Pro 3 (2024/2025)
    if (normalizedName.includes('airpods pro') && normalizedName.includes('3')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 523,
        charging_watt: 0,
        weight_g: 51,
        ip_rating: 'IP54',
        has_wireless_charging: true,
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor, Touch control, Hearing test',
        available_colors: 'White'
      };
    }

    // AirPods Pro 2
    if (normalizedName.includes('airpods pro') && (normalizedName.includes('2') || normalizedName.includes('usb-c'))) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 523, // Earbuds: 43mAh each (86 total) + Case: 437mAh = 523mAh
        charging_watt: 0, // Uses MagSafe/Lightning, no specific wattage
        weight_g: 51, // Case + earbuds
        ip_rating: 'IP54',
        has_wireless_charging: true,
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor, Touch control',
        available_colors: 'White'
      };
    }

    // AirPods Pro (1st gen)
    if (normalizedName.includes('airpods pro')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 469,
        charging_watt: 0,
        weight_g: 56,
        ip_rating: 'IPX4',
        has_wireless_charging: true,
        sensors: 'Accelerometer, Speech-detecting accelerometer, Force sensor, Optical sensor',
        available_colors: 'White'
      };
    }

    // AirPods Max 2 (2024)
    if (normalizedName.includes('airpods max') && normalizedName.includes('2')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 385,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Accelerometer, Gyroscope, Optical sensor',
        available_colors: 'Midnight, Starlight, Blue, Purple, Orange'
      };
    }

    // AirPods Max
    if (normalizedName.includes('airpods max')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 0, // Not publicly disclosed
        charging_watt: 0,
        weight_g: 385,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Accelerometer, Gyroscope, Optical sensor',
        available_colors: 'Space Gray, Silver, Sky Blue, Pink, Green'
      };
    }

    // AirPods 4 with ANC (2024)
    if (normalizedName.includes('airpods 4') && normalizedName.includes('anc')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0, // Not disclosed
        charging_watt: 0,
        weight_g: 50,
        ip_rating: 'IP54',
        has_wireless_charging: true,
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor, Touch control',
        available_colors: 'White'
      };
    }

    // AirPods 4 (2024)
    if (normalizedName.includes('airpods 4')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 43,
        ip_rating: 'IP54',
        has_wireless_charging: false,
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor',
        available_colors: 'White'
      };
    }

    // AirPods 3
    if (normalizedName.includes('airpods 3') || (normalizedName.includes('airpods') && normalizedName.includes('3'))) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 345, // Earbuds: ~38mAh each + Case: ~270mAh
        charging_watt: 0,
        weight_g: 42,
        ip_rating: 'IPX4',
        has_wireless_charging: true,
        sensors: 'Skin-detect sensor, Motion-detecting accelerometer, Speech-detecting accelerometer, Force sensor',
        available_colors: 'White'
      };
    }

    // AirPods 2
    if (normalizedName.includes('airpods 2') || (normalizedName.includes('airpods') && normalizedName.includes('2'))) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 398, // Approximate
        charging_watt: 0,
        weight_g: 40,
        ip_rating: null,
        has_wireless_charging: normalizedName.includes('wireless'),
        sensors: 'Accelerometer, Optical sensor',
        available_colors: 'White'
      };
    }

    // Generic AirPods (1st gen)
    if (normalizedName.includes('airpods')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 380,
        charging_watt: 0,
        weight_g: 38,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Accelerometer, Optical sensor',
        available_colors: 'White'
      };
    }
  }

  // Samsung Galaxy Buds Database
  if (normalizedBrand.includes('samsung')) {
    // Galaxy Buds Pro 2
    if (normalizedName.includes('buds pro 2')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 515, // 61mAh per earbud (122 total) + 515mAh case
        charging_watt: 10, // Wireless charging power
        weight_g: 52,
        ip_rating: 'IPX7',
        has_wireless_charging: true,
        sensors: 'Accelerometer, Gyroscope, Proximity sensor, Hall sensor, Touch sensor, VPU (Voice Pickup Unit)',
        available_colors: 'Graphite, White, Bora Purple'
      };
    }

    // Galaxy Buds 2
    if (normalizedName.includes('buds 2') && !normalizedName.includes('pro')) {
      return {
        bluetooth_version: '5.2',
        has_nfc: false,
        battery_mah: 472, // 61mAh per earbud + 472mAh case
        charging_watt: 10,
        weight_g: 51,
        ip_rating: 'IPX2',
        has_wireless_charging: true,
        sensors: 'Accelerometer, Gyroscope, Proximity sensor, Hall sensor, Touch sensor, VPU',
        available_colors: 'Graphite, White, Olive, Lavender'
      };
    }

    // Galaxy Buds Pro
    if (normalizedName.includes('buds pro')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 472,
        charging_watt: 10,
        weight_g: 55,
        ip_rating: 'IPX7',
        has_wireless_charging: true,
        sensors: 'Accelerometer, Gyroscope, Proximity sensor, Hall sensor, Touch sensor, VPU',
        available_colors: 'Phantom Black, Phantom Silver, Phantom Violet'
      };
    }

    // Galaxy Buds Live
    if (normalizedName.includes('buds live')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 472,
        charging_watt: 10,
        weight_g: 51,
        ip_rating: 'IPX2',
        has_wireless_charging: true,
        sensors: 'Accelerometer, Gyroscope, Proximity sensor, Hall sensor, Touch sensor, VPU',
        available_colors: 'Mystic Bronze, Mystic White, Mystic Black'
      };
    }

    // Galaxy Buds Core
    if (normalizedName.includes('buds core')) {
      return {
        bluetooth_version: '5.4',
        has_nfc: false,
        battery_mah: 460,
        charging_watt: 0,
        weight_g: 47,
        ip_rating: 'IPX7',
        has_wireless_charging: false,
        sensors: 'Touch sensor, Proximity sensor',
        available_colors: 'Black, White'
      };
    }

    // Galaxy Buds+
    if (normalizedName.includes('buds+')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 270,
        charging_watt: 0,
        weight_g: 51,
        ip_rating: 'IPX2',
        has_wireless_charging: true,
        sensors: 'Accelerometer, Proximity sensor, Hall sensor, Touch sensor',
        available_colors: 'Cloud Blue, Cosmic Black, Aura Blue, Aura Red'
      };
    }

    // Galaxy Buds (1st gen)
    if (normalizedName.includes('galaxy buds') && !normalizedName.includes('+') && !normalizedName.includes('pro') && !normalizedName.includes('2') && !normalizedName.includes('live') && !normalizedName.includes('core')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 252,
        charging_watt: 0,
        weight_g: 51,
        ip_rating: 'IPX2',
        has_wireless_charging: true,
        sensors: 'Accelerometer, Proximity sensor, Hall sensor, Touch sensor',
        available_colors: 'Black, White, Yellow'
      };
    }
  }

  // Sony WH/WF Series
  if (normalizedBrand.includes('sony')) {
    // WH-1000XM5
    if (normalizedName.includes('wh-1000xm5') || normalizedName.includes('1000xm5')) {
      return {
        bluetooth_version: '5.2',
        has_nfc: true,
        battery_mah: 0, // Not disclosed
        charging_watt: 0,
        weight_g: 250,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Touch sensor, Wear detection, Voice detection',
        available_colors: 'Black, Silver'
      };
    }

    // WH-1000XM4
    if (normalizedName.includes('wh-1000xm4') || normalizedName.includes('1000xm4')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: true,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 254,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Touch sensor, Wear detection, Voice detection',
        available_colors: 'Black, Silver, Blue'
      };
    }

    // WF-1000XM5
    if (normalizedName.includes('wf-1000xm5')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 59,
        ip_rating: 'IPX4',
        has_wireless_charging: true,
        sensors: 'Touch sensor, Wear detection, Voice detection, Bone conduction sensor',
        available_colors: 'Black, Silver'
      };
    }

    // WF-1000XM4
    if (normalizedName.includes('wf-1000xm4')) {
      return {
        bluetooth_version: '5.2',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 56,
        ip_rating: 'IPX4',
        has_wireless_charging: true,
        sensors: 'Touch sensor, Wear detection, Voice detection, Bone conduction sensor',
        available_colors: 'Black, Silver'
      };
    }
  }

  // Bose QuietComfort Series
  if (normalizedBrand.includes('bose')) {
    // QC45
    if (normalizedName.includes('quietcomfort 45') || normalizedName.includes('qc45')) {
      return {
        bluetooth_version: '5.1',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 240,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Touch sensor, Wear detection',
        available_colors: 'Black, White Smoke, Eclipse Grey'
      };
    }

    // QuietComfort Earbuds II
    if (normalizedName.includes('quietcomfort earbuds ii') || normalizedName.includes('qc earbuds ii')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 59,
        ip_rating: 'IPX4',
        has_wireless_charging: true,
        sensors: 'Touch sensor, Wear detection, CustomTune technology',
        available_colors: 'Triple Black, Soapstone'
      };
    }
  }

  // JBL Series
  if (normalizedBrand.includes('jbl')) {
    // Speakers
    if (normalizedName.includes('partybox 310')) {
      return {
        bluetooth_version: '5.1',
        has_nfc: false,
        battery_mah: 0, // AC powered
        charging_watt: 0,
        weight_g: 16900, // 16.9kg
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Touch controls, LED lights',
        available_colors: 'Black'
      };
    }

    if (normalizedName.includes('partybox 110')) {
      return {
        bluetooth_version: '5.1',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 11300, // 11.3kg
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Touch controls, LED lights',
        available_colors: 'Black'
      };
    }

    if (normalizedName.includes('boombox 4')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 6700, // 6.7kg
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Touch controls',
        available_colors: 'Black, Camo'
      };
    }

    if (normalizedName.includes('boombox 3')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 6700,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Touch controls',
        available_colors: 'Black, Camo'
      };
    }

    if (normalizedName.includes('charge 6')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 1030,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Red, Teal, White'
      };
    }

    if (normalizedName.includes('charge 5')) {
      return {
        bluetooth_version: '5.1',
        has_nfc: false,
        battery_mah: 7500,
        charging_watt: 0,
        weight_g: 960,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Gray, Red, Teal'
      };
    }

    if (normalizedName.includes('flip 7')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 575,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Pink, White'
      };
    }

    if (normalizedName.includes('flip 6')) {
      return {
        bluetooth_version: '5.1',
        has_nfc: false,
        battery_mah: 4800,
        charging_watt: 0,
        weight_g: 550,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Gray, Pink, Red, Teal, White'
      };
    }

    if (normalizedName.includes('clip 5')) {
      return {
        bluetooth_version: '5.1',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 350,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Pink, Red, White'
      };
    }

    if (normalizedName.includes('go 4')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 190,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Pink, White'
      };
    }

    if (normalizedName.includes('go 3')) {
      return {
        bluetooth_version: '5.1',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 209,
        ip_rating: 'IP67',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Pink, Red, White'
      };
    }

    // Headphones
    if (normalizedName.includes('live 770nc')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 254,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Touch controls, Wear detection',
        available_colors: 'Black, Blue, White'
      };
    }

    if (normalizedName.includes('jr310bt')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 115,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Blue, Pink, Red'
      };
    }

    // Earbuds
    if (normalizedName.includes('live pro 2')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 54,
        ip_rating: 'IPX5',
        has_wireless_charging: true,
        sensors: 'Touch controls, Wear detection',
        available_colors: 'Black, Silver'
      };
    }

    if (normalizedName.includes('tune 230')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 50,
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Touch controls',
        available_colors: 'Black, White, Blue, Rose'
      };
    }
  }

  // Beats by Dre
  if (normalizedBrand.includes('beats')) {
    // Beats Fit Pro
    if (normalizedName.includes('fit pro')) {
      return {
        bluetooth_version: '5.0',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 56,
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Accelerometer, Speech-detecting accelerometer, Optical sensor, Press controls',
        available_colors: 'Beats Black, Beats White, Stone Purple, Sage Gray'
      };
    }

    // Beats Studio Buds+
    if (normalizedName.includes('studio buds')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 51,
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Accelerometer, Speech-detecting accelerometer, Press controls',
        available_colors: 'Black, Ivory, Transparent'
      };
    }
  }

  // Anker Soundcore
  if (normalizedBrand.includes('anker')) {
    // Rave 3S PartyBox (Bluetooth Speaker)
    if (normalizedName.includes('rave 3s')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 13400, // Large speaker battery
        charging_watt: 30,
        weight_g: 7200, // 7.2kg
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Touch controls, LED lights',
        available_colors: 'Black'
      };
    }
  }

  // Green Lion
  if (normalizedBrand.includes('green lion')) {
    // Beam Pro
    if (normalizedName.includes('beam pro')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0, // Typical TWS: ~300-400mAh case
        charging_watt: 0,
        weight_g: 45,
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Touch controls',
        available_colors: 'Black, White'
      };
    }

    // Boombeats
    if (normalizedName.includes('boombeats')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 2000, // Portable speaker
        charging_watt: 0,
        weight_g: 600,
        ip_rating: 'IPX5',
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Red'
      };
    }

    // Partylife 300
    if (normalizedName.includes('partylife 300')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 4500,
        charging_watt: 0,
        weight_g: 3200,
        ip_rating: 'IPX5',
        has_wireless_charging: false,
        sensors: 'Button controls, LED lights',
        available_colors: 'Black'
      };
    }

    // Pristone Pro
    if (normalizedName.includes('pristone pro')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 50,
        ip_rating: 'IPX4',
        has_wireless_charging: false,
        sensors: 'Touch controls',
        available_colors: 'Black, White'
      };
    }
  }

  // Harman Kardon
  if (normalizedBrand.includes('harman kardon')) {
    // Onyx Studio 9
    if (normalizedName.includes('onyx studio 9')) {
      return {
        bluetooth_version: '5.3',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 2100,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Beige'
      };
    }

    // Onyx Studio 8
    if (normalizedName.includes('onyx studio 8')) {
      return {
        bluetooth_version: '5.2',
        has_nfc: false,
        battery_mah: 0,
        charging_watt: 0,
        weight_g: 2100,
        ip_rating: null,
        has_wireless_charging: false,
        sensors: 'Button controls',
        available_colors: 'Black, Blue, Champagne'
      };
    }
  }

  console.log(`  ⚠ No preset data for: ${name}`);
  return null;
}

populateAudioSpecs().catch(console.error);
