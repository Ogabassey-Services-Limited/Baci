import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
}

interface ProductKeySpecs {
  product_id: string;
  bluetooth_version?: string;
  has_nfc?: boolean;
  weight_g?: number;
  dimensions_mm?: string;
  available_colors?: string[];
  // For soundbars - repurposing fields
  storage_gb?: number; // Channel count (e.g., 2.1, 5.1 -> store as 2 or 5)
  charging_watt?: number; // Power output in watts
  battery_mah?: number; // For portable speakers
  ip_rating?: string; // Waterproof rating
}

// Comprehensive audio product specs database
const AUDIO_SPECS_DATABASE: Record<string, Partial<ProductKeySpecs>> = {
  // Apple AirPods
  'airpods-max-usb-c': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 384,
    dimensions_mm: '187.3 x 168.6 x 83.4',
    available_colors: ['Silver', 'Space Gray', 'Sky Blue', 'Pink', 'Green']
  },
  'airpods-pro-3': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '30.9 x 21.8 x 24.0',
    available_colors: ['White']
  },
  'airpods-pro-2-usb-c': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '30.9 x 21.8 x 24.0',
    available_colors: ['White']
  },
  'airpods-4': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 4,
    dimensions_mm: '30.2 x 18.3 x 18.1',
    available_colors: ['White']
  },
  'airpods-4-with-anc': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 4,
    dimensions_mm: '30.2 x 18.3 x 18.1',
    available_colors: ['White']
  },

  // Samsung Galaxy Buds
  'samsung-galaxy-buds': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 6,
    dimensions_mm: '17.5 x 19.2 x 22.5',
    available_colors: ['Black', 'White', 'Yellow']
  },
  'samsung-galaxy-buds-core': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '16.5 x 18.0 x 21.0',
    available_colors: ['Black', 'White']
  },
  'samsung-galaxy-buds-fe': {
    bluetooth_version: '5.2',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '20.9 x 19.2 x 18.5',
    available_colors: ['Black', 'White', 'Purple']
  },
  'samsung-galaxy-buds-live': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 6,
    dimensions_mm: '27.3 x 16.5 x 14.9',
    available_colors: ['Mystic Bronze', 'Mystic Black', 'Mystic White']
  },
  'samsung-galaxy-buds-pro': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 7,
    dimensions_mm: '19.5 x 20.5 x 20.8',
    available_colors: ['Phantom Black', 'Phantom Silver', 'Phantom Violet']
  },
  'samsung-galaxy-buds2': {
    bluetooth_version: '5.2',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '17.0 x 20.9 x 21.1',
    available_colors: ['Graphite', 'White', 'Olive', 'Lavender']
  },
  'samsung-galaxy-buds2-pro': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '19.9 x 21.6 x 18.7',
    available_colors: ['Bora Purple', 'Graphite', 'White']
  },
  'samsung-galaxy-buds3': {
    bluetooth_version: '5.4',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '18.0 x 30.0 x 20.0',
    available_colors: ['Silver', 'White']
  },
  'samsung-galaxy-buds3-pro': {
    bluetooth_version: '5.4',
    has_nfc: false,
    weight_g: 5,
    dimensions_mm: '18.4 x 30.0 x 20.0',
    available_colors: ['Silver', 'White']
  },

  // JBL Headphones
  'jbl-jr310bt-kids-headphones': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 115,
    dimensions_mm: '150 x 135 x 50',
    available_colors: ['Red', 'Blue', 'Pink']
  },
  'jbl-tune-520bt': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 157,
    dimensions_mm: '180 x 165 x 70',
    available_colors: ['Black', 'White', 'Blue', 'Purple']
  },
  'jbl-tune-530bt': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 165,
    dimensions_mm: '182 x 167 x 72',
    available_colors: ['Black', 'White', 'Blue', 'Purple']
  },
  'jbl-tune-720bt': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 220,
    dimensions_mm: '195 x 175 x 75',
    available_colors: ['Black', 'White', 'Blue', 'Purple']
  },
  'jbl-tune-670nc': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 220,
    dimensions_mm: '195 x 175 x 75',
    available_colors: ['Black', 'White', 'Blue']
  },
  'jbl-tune-770nc': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 225,
    dimensions_mm: '197 x 178 x 78',
    available_colors: ['Black', 'White', 'Blue']
  },
  'jbl-live-770nc': {
    bluetooth_version: '5.3',
    has_nfc: true,
    weight_g: 240,
    dimensions_mm: '200 x 180 x 80',
    available_colors: ['Black', 'Blue']
  },

  // JBL Portable Speakers
  'jbl-go-3': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 209,
    dimensions_mm: '87.5 x 75 x 41.3',
    battery_mah: 2700,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Red', 'Teal', 'Pink', 'White']
  },
  'jbl-go-4': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 192,
    dimensions_mm: '89 x 75 x 42',
    battery_mah: 2800,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Red', 'Pink', 'Purple']
  },
  'jbl-clip-5': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 350,
    dimensions_mm: '135 x 90 x 63',
    battery_mah: 3200,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Red', 'Camo', 'Pink']
  },
  'jbl-flip-6': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 550,
    dimensions_mm: '178 x 68 x 72',
    battery_mah: 4800,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Red', 'Teal', 'Grey', 'White', 'Pink']
  },
  'jbl-flip-7': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 530,
    dimensions_mm: '180 x 70 x 72',
    battery_mah: 5000,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Red', 'Purple', 'Camo']
  },
  'jbl-charge-5': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 960,
    dimensions_mm: '223 x 96 x 94',
    battery_mah: 7500,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Red', 'Camo', 'Grey', 'Teal']
  },
  'jbl-charge-6': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 930,
    dimensions_mm: '220 x 95 x 93',
    battery_mah: 7500,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Red', 'Camo', 'White', 'Purple', 'Sand']
  },
  'jbl-xtreme-3': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 1970,
    dimensions_mm: '298 x 136 x 134',
    battery_mah: 15000,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Camo']
  },
  'jbl-xtreme-4': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 2100,
    dimensions_mm: '300 x 145 x 145',
    battery_mah: 15600,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Blue', 'Camo']
  },
  'jbl-boombox-3': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 6700,
    dimensions_mm: '481 x 258 x 201',
    battery_mah: 24000,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Camo']
  },
  'jbl-boombox-4': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 7300,
    dimensions_mm: '495 x 270 x 210',
    battery_mah: 26400,
    ip_rating: 'IP67',
    available_colors: ['Black', 'Camo']
  },

  // JBL Party Speakers
  'jbl-partybox-110': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 11300,
    dimensions_mm: '325 x 295 x 572',
    battery_mah: 18000,
    charging_watt: 160,
    available_colors: ['Black']
  },
  'jbl-partybox-club-120': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 11500,
    dimensions_mm: '330 x 300 x 578',
    battery_mah: 18500,
    charging_watt: 160,
    available_colors: ['Black']
  },
  'jbl-partybox-310': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 17300,
    dimensions_mm: '326 x 688 x 368',
    battery_mah: 18000,
    charging_watt: 240,
    available_colors: ['Black']
  },
  'jbl-partybox-stage-320': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 17800,
    dimensions_mm: '330 x 695 x 370',
    battery_mah: 19200,
    charging_watt: 240,
    available_colors: ['Black']
  },
  'jbl-partybox-encore-2': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 12500,
    dimensions_mm: '277 x 587 x 293',
    battery_mah: 15000,
    charging_watt: 180,
    available_colors: ['Black']
  },

  // Other Brands - Speakers
  'harman-kardon-onyx-studio-8': {
    bluetooth_version: '5.2',
    has_nfc: false,
    weight_g: 2900,
    dimensions_mm: '291 x 291 x 151',
    battery_mah: 14000,
    available_colors: ['Black', 'Blue']
  },
  'harman-kardon-onyx-studio-9': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 2850,
    dimensions_mm: '290 x 290 x 150',
    battery_mah: 14400,
    available_colors: ['Black', 'Blue', 'Gold']
  },
  'xiaomi-sound-outdoor-30w-speaker': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 1200,
    dimensions_mm: '210 x 85 x 85',
    battery_mah: 5200,
    ip_rating: 'IPX7',
    charging_watt: 30,
    available_colors: ['Black', 'Grey']
  },
  'speaker-sony-xg500': {
    bluetooth_version: '5.2',
    has_nfc: false,
    weight_g: 5600,
    dimensions_mm: '450 x 208 x 215',
    battery_mah: 17000,
    ip_rating: 'IP66',
    charging_watt: 200,
    available_colors: ['Black']
  },
  'anker-soundcore-rave-3s-partybox': {
    bluetooth_version: '5.3',
    has_nfc: false,
    weight_g: 12000,
    dimensions_mm: '400 x 250 x 250',
    battery_mah: 18000,
    charging_watt: 200,
    available_colors: ['Black']
  },
  'skullcandy-barrel-boombox': {
    bluetooth_version: '5.2',
    has_nfc: false,
    weight_g: 10500,
    dimensions_mm: '380 x 230 x 230',
    battery_mah: 15000,
    charging_watt: 150,
    available_colors: ['Black', 'Blue']
  },
  'green-lion-partylife-300': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 8500,
    dimensions_mm: '350 x 200 x 200',
    battery_mah: 12000,
    charging_watt: 120,
    available_colors: ['Black']
  },
  'green-lion-boombeats': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 1200,
    dimensions_mm: '220 x 90 x 90',
    battery_mah: 4000,
    ip_rating: 'IPX5',
    available_colors: ['Black', 'Blue']
  },
  'green-lion-pristone-pro': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 450,
    dimensions_mm: '150 x 70 x 70',
    battery_mah: 2400,
    ip_rating: 'IPX5',
    available_colors: ['Black', 'Red']
  },
  'green-lion-beam-pro': {
    bluetooth_version: '5.1',
    has_nfc: false,
    weight_g: 2500,
    dimensions_mm: '280 x 120 x 120',
    battery_mah: 8000,
    available_colors: ['Black']
  },

  // Soundbars
  'sony-solo-sound-bar-ht-s100f': {
    bluetooth_version: '4.2',
    has_nfc: false,
    weight_g: 1800,
    dimensions_mm: '900 x 64 x 88',
    storage_gb: 2, // 2.0 channel
    charging_watt: 120,
    available_colors: ['Black']
  },
  'sony-sound-bar-ht-g700': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 3200,
    dimensions_mm: '980 x 64 x 108',
    storage_gb: 3, // 3.1 channel
    charging_watt: 400,
    available_colors: ['Black']
  },
  'sony-sound-bar-ht-s400': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 2900,
    dimensions_mm: '900 x 64 x 96',
    storage_gb: 2, // 2.1 channel
    charging_watt: 330,
    available_colors: ['Black']
  },
  'sony-sound-bar-ht-a5000': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 5600,
    dimensions_mm: '1210 x 68 x 135',
    storage_gb: 5, // 5.1.2 channel
    charging_watt: 500,
    available_colors: ['Black']
  },
  'lg-sound-bar-sk5': {
    bluetooth_version: '4.0',
    has_nfc: false,
    weight_g: 2800,
    dimensions_mm: '950 x 57 x 85',
    storage_gb: 2, // 2.1 channel
    charging_watt: 360,
    available_colors: ['Black']
  },
  'lg-sound-bar-sp6': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 3100,
    dimensions_mm: '960 x 65 x 95',
    storage_gb: 3, // 3.1 channel
    charging_watt: 420,
    available_colors: ['Black']
  },
  'lg-sound-bar-sp9': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 3500,
    dimensions_mm: '1080 x 65 x 105',
    storage_gb: 5, // 5.1.2 channel
    charging_watt: 520,
    available_colors: ['Black']
  },
  'samsung-sound-bar-hw-ta450': {
    bluetooth_version: '4.2',
    has_nfc: false,
    weight_g: 2500,
    dimensions_mm: '850 x 54 x 85',
    storage_gb: 2, // 2.1 channel
    charging_watt: 200,
    available_colors: ['Black']
  },
  'samsung-sound-bar-hw-tc450-brand-new': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 2600,
    dimensions_mm: '860 x 55 x 86',
    storage_gb: 2, // 2.1 channel
    charging_watt: 200,
    available_colors: ['Black']
  },
  'samsung-sound-bar-hw-k450': {
    bluetooth_version: '4.1',
    has_nfc: false,
    weight_g: 2700,
    dimensions_mm: '890 x 54 x 88',
    storage_gb: 2, // 2.1 channel
    charging_watt: 300,
    available_colors: ['Black']
  },
  'samsung-sound-bar-hw-q800a': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 4200,
    dimensions_mm: '980 x 62 x 115',
    storage_gb: 3, // 3.1.2 channel
    charging_watt: 330,
    available_colors: ['Black']
  },
  'samsung-sound-bar-hw-q800b': {
    bluetooth_version: '5.0',
    has_nfc: false,
    weight_g: 4300,
    dimensions_mm: '980 x 62 x 115',
    storage_gb: 3, // 3.1.2 channel
    charging_watt: 360,
    available_colors: ['Black']
  },
  'samsung-sound-bar-hw-q910c': {
    bluetooth_version: '5.2',
    has_nfc: false,
    weight_g: 6800,
    dimensions_mm: '1232 x 69 x 138',
    storage_gb: 9, // 9.1.4 channel
    charging_watt: 540,
    available_colors: ['Black']
  }
};

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^speaker-\s*/i, '') // Remove "speaker-" prefix
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function getAudioProductsWithoutSpecs(): Promise<Product[]> {
  console.log('📡 Fetching audio products without specs...');

  // Get products from Audio, Earbuds, Headphones, and Soundbars categories
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('category.ilike.%audio%,category.ilike.%earbuds%,category.ilike.%headphones%,category.ilike.%soundbar%')
    .order('name');

  if (error) {
    console.error('❌ Error fetching products:', error);
    throw error;
  }

  if (!products || products.length === 0) {
    console.log('⚠️  No audio products found');
    return [];
  }

  console.log(`📦 Found ${products.length} audio products total`);

  // Filter out products that already have specs
  const productsWithoutSpecs: Product[] = [];

  for (const product of products) {
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .single();

    if (!specs) {
      productsWithoutSpecs.push(product);
    }
  }

  console.log(`🔍 Found ${productsWithoutSpecs.length} products without specs`);
  return productsWithoutSpecs;
}

function findSpecsForProduct(productName: string): Partial<ProductKeySpecs> | null {
  const normalized = normalizeProductName(productName);

  // Try exact match first
  if (AUDIO_SPECS_DATABASE[normalized]) {
    return AUDIO_SPECS_DATABASE[normalized];
  }

  // Try fuzzy matching
  for (const [key, specs] of Object.entries(AUDIO_SPECS_DATABASE)) {
    // Check if the product name contains the key or vice versa
    if (normalized.includes(key) || key.includes(normalized)) {
      return specs;
    }

    // Check if most words match
    const keyWords = key.split('-').filter(w => w.length > 2);
    const nameWords = normalized.split('-').filter(w => w.length > 2);
    const matchCount = keyWords.filter(w => nameWords.includes(w)).length;

    if (matchCount >= Math.min(keyWords.length, nameWords.length) * 0.7) {
      return specs;
    }
  }

  return null;
}

async function populateAudioSpecs() {
  console.log('🎵 Starting Audio & Soundbar Specs Population\n');

  const products = await getAudioProductsWithoutSpecs();

  if (products.length === 0) {
    console.log('✅ All audio products already have specs!');
    return;
  }

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const failed: string[] = [];

  // Process ALL products without specs
  const productsToProcess = products;

  console.log(`\n📋 Processing ${productsToProcess.length} products without specs\n`);

  // Process in batches
  const BATCH_SIZE = 10;
  for (let i = 0; i < productsToProcess.length; i += BATCH_SIZE) {
    const batch = productsToProcess.slice(i, i + BATCH_SIZE);
    const specsToInsert: (ProductKeySpecs & { product_id: string })[] = [];

    for (const product of batch) {
      console.log(`\n[${i + batch.indexOf(product) + 1}/${productsToProcess.length}] Processing: ${product.name}`);

      const specs = findSpecsForProduct(product.name);

      if (!specs) {
        console.log(`  ⚠️  No specs found in database`);
        failed.push(product.name);
        failedCount++;
        continue;
      }

      console.log(`  ✅ Found specs match`);

      const specsRecord: ProductKeySpecs & { product_id: string } = {
        product_id: product.id,
        ...specs
      };

      specsToInsert.push(specsRecord);
    }

    // Batch insert
    if (specsToInsert.length > 0) {
      const { error } = await supabase
        .from('product_key_specs')
        .upsert(specsToInsert, {
          onConflict: 'product_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`\n❌ Batch insert error:`, error);
        failedCount += specsToInsert.length;
      } else {
        successCount += specsToInsert.length;
        console.log(`\n✅ Inserted ${specsToInsert.length} specs records`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 POPULATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`⚠️  Failed: ${failedCount}`);
  console.log(`Total Processed: ${successCount + failedCount}`);

  if (failed.length > 0) {
    console.log('\n❌ Failed Products:');
    failed.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n🎉 Audio & Soundbar specs population complete!');
}

// Run the script
populateAudioSpecs().catch(console.error);
