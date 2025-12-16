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
}

interface SpecData {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  refresh_rate_hz?: number;
  display_resolution?: string;
  display_ppi?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  main_camera_mp?: number;
  front_camera_mp?: number;
  has_ois?: boolean;
  has_triple_camera?: boolean;
  battery_mah?: number;
  charging_watt?: number;
  has_wireless_charging?: boolean;
  has_nfc?: boolean;
  is_5g?: boolean;
  weight_g?: number;
  dimensions_mm?: string;
  ip_rating?: string;
  available_colors?: string[];
  release_date?: string;
}

// Comprehensive iPhone spec database
const IPHONE_SPECS: Record<string, Partial<SpecData>> = {
  'iPhone 15 Pro Max': {
    screen_size_inches: 6.7,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 120,
    display_resolution: '1290x2796',
    display_ppi: 460,
    chipset: 'Apple A17 Pro Bionic',
    ram_gb: 8,
    main_camera_mp: 48,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    battery_mah: 4441,
    charging_watt: 27,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 221,
    dimensions_mm: '159.9x76.7x8.3',
    ip_rating: 'IP68',
    available_colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
    release_date: '2023'
  },
  'iPhone 15 Pro': {
    screen_size_inches: 6.1,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 120,
    display_resolution: '1179x2556',
    display_ppi: 460,
    chipset: 'Apple A17 Pro Bionic',
    ram_gb: 8,
    main_camera_mp: 48,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    battery_mah: 3274,
    charging_watt: 27,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 187,
    dimensions_mm: '146.6x70.6x8.3',
    ip_rating: 'IP68',
    available_colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
    release_date: '2023'
  },
  'iPhone 15 Plus': {
    screen_size_inches: 6.7,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 60,
    display_resolution: '1290x2796',
    display_ppi: 460,
    chipset: 'Apple A16 Bionic',
    ram_gb: 6,
    main_camera_mp: 48,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 4383,
    charging_watt: 20,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 201,
    dimensions_mm: '160.9x77.8x7.8',
    ip_rating: 'IP68',
    available_colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black'],
    release_date: '2023'
  },
  'iPhone 15': {
    screen_size_inches: 6.1,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 60,
    display_resolution: '1179x2556',
    display_ppi: 460,
    chipset: 'Apple A16 Bionic',
    ram_gb: 6,
    main_camera_mp: 48,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 3349,
    charging_watt: 20,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 171,
    dimensions_mm: '147.6x71.6x7.8',
    ip_rating: 'IP68',
    available_colors: ['Pink', 'Yellow', 'Green', 'Blue', 'Black'],
    release_date: '2023'
  },
  'iPhone 14 Pro Max': {
    screen_size_inches: 6.7,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 120,
    display_resolution: '1290x2796',
    display_ppi: 460,
    chipset: 'Apple A16 Bionic',
    ram_gb: 6,
    main_camera_mp: 48,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    battery_mah: 4323,
    charging_watt: 27,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 240,
    dimensions_mm: '160.7x77.6x7.9',
    ip_rating: 'IP68',
    available_colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'],
    release_date: '2022'
  },
  'iPhone 14 Pro': {
    screen_size_inches: 6.1,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 120,
    display_resolution: '1179x2556',
    display_ppi: 460,
    chipset: 'Apple A16 Bionic',
    ram_gb: 6,
    main_camera_mp: 48,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    battery_mah: 3200,
    charging_watt: 27,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 206,
    dimensions_mm: '147.5x71.5x7.9',
    ip_rating: 'IP68',
    available_colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'],
    release_date: '2022'
  },
  'iPhone 14': {
    screen_size_inches: 6.1,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 60,
    display_resolution: '1170x2532',
    display_ppi: 460,
    chipset: 'Apple A15 Bionic',
    ram_gb: 6,
    main_camera_mp: 12,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 3279,
    charging_watt: 20,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 172,
    dimensions_mm: '146.7x71.5x7.8',
    ip_rating: 'IP68',
    available_colors: ['Midnight', 'Purple', 'Starlight', 'Blue', 'Red', 'Yellow'],
    release_date: '2022'
  },
  'iPhone 13 Pro Max': {
    screen_size_inches: 6.7,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 120,
    display_resolution: '1284x2778',
    display_ppi: 458,
    chipset: 'Apple A15 Bionic',
    ram_gb: 6,
    main_camera_mp: 12,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    battery_mah: 4352,
    charging_watt: 27,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 238,
    dimensions_mm: '160.8x78.1x7.7',
    ip_rating: 'IP68',
    available_colors: ['Sierra Blue', 'Silver', 'Gold', 'Graphite'],
    release_date: '2021'
  },
  'iPhone 12 Pro Max': {
    screen_size_inches: 6.7,
    display_type: 'Super Retina XDR OLED',
    refresh_rate_hz: 60,
    display_resolution: '1284x2778',
    display_ppi: 458,
    chipset: 'Apple A14 Bionic',
    ram_gb: 6,
    main_camera_mp: 12,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    battery_mah: 3687,
    charging_watt: 20,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 228,
    dimensions_mm: '160.8x78.1x7.4',
    ip_rating: 'IP68',
    available_colors: ['Pacific Blue', 'Gold', 'Silver', 'Graphite'],
    release_date: '2020'
  },
  'iPhone XS Max': {
    screen_size_inches: 6.5,
    display_type: 'Super Retina OLED',
    refresh_rate_hz: 60,
    display_resolution: '1242x2688',
    display_ppi: 458,
    chipset: 'Apple A12 Bionic',
    ram_gb: 4,
    main_camera_mp: 12,
    front_camera_mp: 7,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 3174,
    charging_watt: 15,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: false,
    weight_g: 208,
    dimensions_mm: '157.5x77.4x7.7',
    ip_rating: 'IP68',
    available_colors: ['Gold', 'Silver', 'Space Gray'],
    release_date: '2018'
  },
  'iPhone X': {
    screen_size_inches: 5.8,
    display_type: 'Super Retina OLED',
    refresh_rate_hz: 60,
    display_resolution: '1125x2436',
    display_ppi: 458,
    chipset: 'Apple A11 Bionic',
    ram_gb: 3,
    main_camera_mp: 12,
    front_camera_mp: 7,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 2716,
    charging_watt: 15,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: false,
    weight_g: 174,
    dimensions_mm: '143.6x70.9x7.7',
    ip_rating: 'IP67',
    available_colors: ['Silver', 'Space Gray'],
    release_date: '2017'
  },
  'iPhone SE (3rd Gen)': {
    screen_size_inches: 4.7,
    display_type: 'Retina IPS LCD',
    refresh_rate_hz: 60,
    display_resolution: '750x1334',
    display_ppi: 326,
    chipset: 'Apple A15 Bionic',
    ram_gb: 4,
    main_camera_mp: 12,
    front_camera_mp: 7,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 2018,
    charging_watt: 20,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 144,
    dimensions_mm: '138.4x67.3x7.3',
    ip_rating: 'IP67',
    available_colors: ['Midnight', 'Starlight', 'Red'],
    release_date: '2022'
  },
  'iPhone SE (2nd Gen)': {
    screen_size_inches: 4.7,
    display_type: 'Retina IPS LCD',
    refresh_rate_hz: 60,
    display_resolution: '750x1334',
    display_ppi: 326,
    chipset: 'Apple A13 Bionic',
    ram_gb: 3,
    main_camera_mp: 12,
    front_camera_mp: 7,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 1821,
    charging_watt: 18,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: false,
    weight_g: 148,
    dimensions_mm: '138.4x67.3x7.3',
    ip_rating: 'IP67',
    available_colors: ['White', 'Black', 'Red'],
    release_date: '2020'
  },
  'iPhone 8 Plus': {
    screen_size_inches: 5.5,
    display_type: 'Retina IPS LCD',
    refresh_rate_hz: 60,
    display_resolution: '1080x1920',
    display_ppi: 401,
    chipset: 'Apple A11 Bionic',
    ram_gb: 3,
    main_camera_mp: 12,
    front_camera_mp: 7,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 2691,
    charging_watt: 15,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: false,
    weight_g: 202,
    dimensions_mm: '158.4x78.1x7.5',
    ip_rating: 'IP67',
    available_colors: ['Silver', 'Space Gray', 'Gold'],
    release_date: '2017'
  },
  'iPhone 8': {
    screen_size_inches: 4.7,
    display_type: 'Retina IPS LCD',
    refresh_rate_hz: 60,
    display_resolution: '750x1334',
    display_ppi: 326,
    chipset: 'Apple A11 Bionic',
    ram_gb: 2,
    main_camera_mp: 12,
    front_camera_mp: 7,
    has_ois: true,
    has_triple_camera: false,
    battery_mah: 1821,
    charging_watt: 15,
    has_wireless_charging: true,
    has_nfc: true,
    is_5g: false,
    weight_g: 148,
    dimensions_mm: '138.4x67.3x7.3',
    ip_rating: 'IP67',
    available_colors: ['Silver', 'Space Gray', 'Gold'],
    release_date: '2017'
  }
};

// Function to match product name to spec template
function findMatchingSpecs(productName: string): Partial<SpecData> | null {
  const nameLower = productName.toLowerCase();

  // Try exact model matches first
  for (const [model, specs] of Object.entries(IPHONE_SPECS)) {
    if (nameLower.includes(model.toLowerCase())) {
      return specs;
    }
  }

  // Try partial matches
  if (nameLower.includes('15 pro max')) return IPHONE_SPECS['iPhone 15 Pro Max'];
  if (nameLower.includes('15 pro')) return IPHONE_SPECS['iPhone 15 Pro'];
  if (nameLower.includes('15 plus')) return IPHONE_SPECS['iPhone 15 Plus'];
  if (nameLower.includes('iphone 15')) return IPHONE_SPECS['iPhone 15'];

  if (nameLower.includes('14 pro max')) return IPHONE_SPECS['iPhone 14 Pro Max'];
  if (nameLower.includes('14 pro')) return IPHONE_SPECS['iPhone 14 Pro'];
  if (nameLower.includes('iphone 14')) return IPHONE_SPECS['iPhone 14'];

  if (nameLower.includes('13 pro max')) return IPHONE_SPECS['iPhone 13 Pro Max'];

  if (nameLower.includes('12 pro max')) return IPHONE_SPECS['iPhone 12 Pro Max'];

  if (nameLower.includes('xs max')) return IPHONE_SPECS['iPhone XS Max'];
  if (nameLower.includes('iphone x')) return IPHONE_SPECS['iPhone X'];

  if (nameLower.includes('se') && nameLower.includes('3rd')) return IPHONE_SPECS['iPhone SE (3rd Gen)'];
  if (nameLower.includes('se') && nameLower.includes('2nd')) return IPHONE_SPECS['iPhone SE (2nd Gen)'];

  if (nameLower.includes('8 plus')) return IPHONE_SPECS['iPhone 8 Plus'];
  if (nameLower.includes('iphone 8')) return IPHONE_SPECS['iPhone 8'];

  return null;
}

// Extract storage from product name
function extractStorage(productName: string): number | undefined {
  const match = productName.match(/(\d+)GB/i);
  if (match) {
    const storage = parseInt(match[1]);
    // Only return if it's a reasonable storage size
    if (storage >= 64 && storage <= 2048) {
      return storage;
    }
  }
  return undefined;
}

async function getApplePhonesWithoutSpecs(): Promise<Product[]> {
  console.log('Fetching Apple phones without specs...\n');

  const { data: existingSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specProductIds = existingSpecs?.map(s => s.product_id) || [];

  let query = supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%')
    .neq('status', 'archived');

  if (specProductIds.length > 0) {
    query = query.not('id', 'in', `(${specProductIds.join(',')})`);
  }

  const { data, error } = await query.limit(20);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} Apple phones without specs\n`);
  return data || [];
}

async function insertSpecs(specs: SpecData): Promise<boolean> {
  const { error } = await supabase
    .from('product_key_specs')
    .insert(specs);

  if (error) {
    console.error(`  Error inserting specs: ${error.message}`);
    return false;
  }

  return true;
}

async function processProduct(product: Product): Promise<boolean> {
  console.log(`\nProcessing: ${product.brand} ${product.name}`);

  const baseSpecs = findMatchingSpecs(product.name);

  if (!baseSpecs) {
    console.log(`  ⚠ No matching spec template found`);
    return false;
  }

  // Extract storage from product name
  const storage = extractStorage(product.name);

  const specs: SpecData = {
    product_id: product.id,
    ...baseSpecs,
    ...(storage && { storage_gb: storage })
  };

  console.log(`  ✓ Matched to template: ${Object.keys(baseSpecs).length} fields`);
  if (storage) console.log(`  ✓ Extracted storage: ${storage}GB`);

  const success = await insertSpecs(specs);

  if (success) {
    console.log(`  ✓ Specs inserted successfully`);
  }

  return success;
}

async function main() {
  console.log('=== Apple Phone Spec Populator (Manual) ===\n');

  const products = await getApplePhonesWithoutSpecs();

  if (products.length === 0) {
    console.log('No Apple phones found without specs!');
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  const failed: string[] = [];

  for (const product of products) {
    const success = await processProduct(product);

    if (success) {
      successCount++;
    } else {
      failureCount++;
      failed.push(product.name);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total processed: ${products.length}`);
  console.log(`Successes: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Success rate: ${((successCount / products.length) * 100).toFixed(1)}%`);

  if (failed.length > 0) {
    console.log('\nFailed products:');
    failed.forEach(name => console.log(`  - ${name}`));
  }
}

main().catch(console.error);
