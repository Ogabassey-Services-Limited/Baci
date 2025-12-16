import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface KeySpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  refresh_rate_hz?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  main_camera_mp?: number;
  front_camera_mp?: number;
  battery_mah?: number;
  charging_watt?: number;
  has_nfc?: boolean;
  is_5g?: boolean;
  weight_g?: number;
  available_colors?: string[];
}

// Manual spec data for the 12 products found
const specsData: Record<string, Partial<KeySpecs>> = {
  // Tecno Spark 30 Pro
  '2d8c1b5f-45bf-4bff-a7a8-27c303cb5193': {
    screen_size_inches: 6.78,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Helio G100',
    ram_gb: 8,
    storage_gb: 128,
    main_camera_mp: 108,
    front_camera_mp: 13,
    battery_mah: 5000,
    charging_watt: 33,
    has_nfc: false,
    is_5g: false,
    weight_g: 188,
    available_colors: ['Obsidian Edge', 'Azure Sky', 'Glacial Frost']
  },

  // Oppo A3x (2024) 4GB/64GB
  '921d6f79-89e3-4550-b322-d957ef6edfa2': {
    screen_size_inches: 6.67,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 6s Gen 3',
    ram_gb: 4,
    storage_gb: 64,
    main_camera_mp: 50,
    front_camera_mp: 5,
    battery_mah: 5100,
    charging_watt: 45,
    has_nfc: false,
    is_5g: true,
    weight_g: 196,
    available_colors: ['Starry Purple', 'Starlight White', 'Midnight Black']
  },

  // Tecno Pop 10C 2GB 64GB
  '0cef9652-1822-4b47-80b6-627943d1a048': {
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 2,
    storage_gb: 64,
    main_camera_mp: 13,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 10,
    has_nfc: false,
    is_5g: false,
    weight_g: 192,
    available_colors: ['Mystery White', 'Gravity Black', 'Lime Green']
  },

  // Tecno Spark 40 8GB 256GB
  'a87c2a7b-0478-4926-9c10-7c11765b46ad': {
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 7300',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 108,
    front_camera_mp: 13,
    battery_mah: 5000,
    charging_watt: 45,
    has_nfc: false,
    is_5g: true,
    weight_g: 185,
    available_colors: ['Obsidian Black', 'Lucent White', 'Emerald Green']
  },

  // Tecno Pop 10 3GB 64GB
  'dc914d37-2b64-426d-8225-561d85265a07': {
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 3,
    storage_gb: 64,
    main_camera_mp: 13,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 15,
    has_nfc: false,
    is_5g: false,
    weight_g: 192,
    available_colors: ['Azure', 'Graphite', 'Aurora']
  },

  // itel X8c 8GB 512GB
  'c25ef9be-041d-460f-9649-3c92be691b89': {
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 8,
    storage_gb: 512,
    main_camera_mp: 50,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 18,
    has_nfc: false,
    is_5g: false,
    weight_g: 195,
    available_colors: ['Sky Blue', 'Starry Black', 'Elegant White']
  },

  // vivo Y21d 4GB 128GB
  '8855767c-971a-4bbb-b95c-e111ae09610c': {
    screen_size_inches: 6.51,
    display_type: 'IPS LCD',
    refresh_rate_hz: 60,
    chipset: 'MediaTek Helio P35',
    ram_gb: 4,
    storage_gb: 128,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 10,
    has_nfc: false,
    is_5g: false,
    weight_g: 182,
    available_colors: ['Midnight Blue', 'Diamond Glow']
  },

  // vivo Y21d 6GB 128GB
  '951b32fa-6a80-4bf4-b69a-22b12835c185': {
    screen_size_inches: 6.51,
    display_type: 'IPS LCD',
    refresh_rate_hz: 60,
    chipset: 'MediaTek Helio P35',
    ram_gb: 6,
    storage_gb: 128,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 10,
    has_nfc: false,
    is_5g: false,
    weight_g: 182,
    available_colors: ['Midnight Blue', 'Diamond Glow']
  },

  // Tecno Spark 40 Pro 8GB 128GB
  '018ba498-e827-4aac-ab65-32814aa765c2': {
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 7300',
    ram_gb: 8,
    storage_gb: 128,
    main_camera_mp: 108,
    front_camera_mp: 13,
    battery_mah: 5000,
    charging_watt: 45,
    has_nfc: false,
    is_5g: true,
    weight_g: 185,
    available_colors: ['Obsidian Black', 'Lucent White', 'Emerald Green']
  },

  // itel X9c 8GB 256GB
  '2f2c5de7-6c4b-4bfc-b021-a8f1df2fa2df': {
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 18,
    has_nfc: false,
    is_5g: false,
    weight_g: 195,
    available_colors: ['Sky Blue', 'Starry Black', 'Elegant White']
  },

  // Oppo A6 Pro 4G 8GB/256GB
  'e5d2d66b-aaef-41eb-b733-83dd038981f2': {
    screen_size_inches: 6.7,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 6300',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 45,
    has_nfc: false,
    is_5g: false,
    weight_g: 189,
    available_colors: ['Starry Purple', 'Starlight White']
  },

  // Tecno POP 10 Pro 4GB 128GB
  'e136aaf0-0be7-40e2-b0fd-619e9703243b': {
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 4,
    storage_gb: 128,
    main_camera_mp: 13,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 15,
    has_nfc: false,
    is_5g: false,
    weight_g: 192,
    available_colors: ['Azure', 'Graphite', 'Aurora']
  }
};

async function insertSpecs(productId: string, specs: Partial<KeySpecs>): Promise<boolean> {
  const fullSpecs: KeySpecs = {
    product_id: productId,
    ...specs
  };

  console.log(`Inserting specs for product ${productId}...`);

  const { error } = await supabase
    .from('product_key_specs')
    .insert(fullSpecs);

  if (error) {
    console.error('Error inserting specs:', error);
    return false;
  }

  console.log('✅ Successfully inserted specs');
  return true;
}

async function main() {
  console.log('=== Populating Other Phone Brands Specs ===');
  console.log('Brands: Infinix, Tecno, vivo, itel, Oppo\n');

  let successCount = 0;
  let failCount = 0;

  for (const [productId, specs] of Object.entries(specsData)) {
    console.log(`\n--- Processing product ${productId} ---`);
    const success = await insertSpecs(productId, specs);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Small delay between inserts
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${successCount + failCount}`);
}

main().catch(console.error);
