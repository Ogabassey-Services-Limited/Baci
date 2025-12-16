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

// Batch 2: Additional 20 products from the remaining 32
const specsData: Record<string, Partial<KeySpecs>> = {
  // TECNO products
  'a994dc68-061e-4a33-b844-3f4f395c526f': { // Tecno Pop 10 3GB 128GB
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 3,
    storage_gb: 128,
    main_camera_mp: 13,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 15,
    has_nfc: false,
    is_5g: false,
    weight_g: 192,
    available_colors: ['Azure', 'Graphite', 'Aurora']
  },

  '5bb94eed-4921-42a5-8327-ee651b6bb68a': { // Tecno Spark 40 4GB 128GB
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 7300',
    ram_gb: 4,
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

  'c45cb5c3-c947-47a7-a513-4fd5153058a2': { // Tecno Spark 40 Pro 8GB 256GB
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

  '0984d97a-e8aa-47d1-a2ec-0481f24cfeb1': { // Tecno Spark 30 Pro 8GB 256GB
    screen_size_inches: 6.78,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Helio G100',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 108,
    front_camera_mp: 13,
    battery_mah: 5000,
    charging_watt: 33,
    has_nfc: false,
    is_5g: false,
    weight_g: 188,
    available_colors: ['Obsidian Edge', 'Azure Sky', 'Glacial Frost']
  },

  'c03e84b5-72b4-412e-a4e8-dc56ebe45bc3': { // Tecno Camon 40 8GB 128GB
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 7020',
    ram_gb: 8,
    storage_gb: 128,
    main_camera_mp: 50,
    front_camera_mp: 50,
    battery_mah: 5000,
    charging_watt: 33,
    has_nfc: false,
    is_5g: true,
    weight_g: 175,
    available_colors: ['Midnight Shadow', 'Celestial Silver']
  },

  '9a456975-9377-4bcb-90b3-2f0a782f9cd6': { // Tecno Camon 40 8GB 256GB
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 7020',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 50,
    battery_mah: 5000,
    charging_watt: 33,
    has_nfc: false,
    is_5g: true,
    weight_g: 175,
    available_colors: ['Midnight Shadow', 'Celestial Silver']
  },

  '9da18eab-cce1-4301-9aeb-b0f322d4b21d': { // Tecno Camon 40 Pro 8GB 256GB
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 144,
    chipset: 'MediaTek Dimensity 8200',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 50,
    battery_mah: 5000,
    charging_watt: 70,
    has_nfc: true,
    is_5g: true,
    weight_g: 180,
    available_colors: ['Obsidian Black', 'Pearl White']
  },

  'f15b89e5-1b4b-4a9b-b9c5-29946f5663aa': { // Tecno Pop 8 2GB 64GB
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

  '77c6a51c-2eef-4fbb-b5af-e15e691fe38c': { // Tecno Phantom V Flip 2 8GB 256GB
    screen_size_inches: 6.9,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 8020',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 32,
    battery_mah: 4720,
    charging_watt: 70,
    has_nfc: true,
    is_5g: true,
    weight_g: 196,
    available_colors: ['Mystic Dawn', 'Iconic Black']
  },

  '3ac0fcdd-a4e7-45eb-b0a5-dc25016add80': { // Tecno Phantom V Fold 2 12GB 512GB
    screen_size_inches: 7.85,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 9000+',
    ram_gb: 12,
    storage_gb: 512,
    main_camera_mp: 50,
    front_camera_mp: 32,
    battery_mah: 5750,
    charging_watt: 70,
    has_nfc: true,
    is_5g: true,
    weight_g: 249,
    available_colors: ['Karst Blue', 'Rippling Purple']
  },

  // VIVO products
  '5944f0f1-5e77-470f-8d1b-8f324a1f6137': { // vivo V50 12GB 512GB
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 9300',
    ram_gb: 12,
    storage_gb: 512,
    main_camera_mp: 50,
    front_camera_mp: 50,
    battery_mah: 5000,
    charging_watt: 80,
    has_nfc: true,
    is_5g: true,
    weight_g: 193,
    available_colors: ['Noble Black', 'Breeze Blue']
  },

  '8edc7a5a-d4b5-47f4-b53d-d200eee21394': { // vivo Y29 8GB 128GB
    screen_size_inches: 6.68,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 6300',
    ram_gb: 8,
    storage_gb: 128,
    main_camera_mp: 50,
    front_camera_mp: 8,
    battery_mah: 5500,
    charging_watt: 44,
    has_nfc: false,
    is_5g: true,
    weight_g: 198,
    available_colors: ['Glacier Blue', 'Titanium Gold']
  },

  '9779fcc9-cd76-44ea-bf79-e4926df8863e': { // vivo Y29 8GB 256GB
    screen_size_inches: 6.68,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 6300',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 8,
    battery_mah: 5500,
    charging_watt: 44,
    has_nfc: false,
    is_5g: true,
    weight_g: 198,
    available_colors: ['Glacier Blue', 'Titanium Gold']
  },

  'ed4ca8a5-d24c-4145-99a2-d376c6e206b9': { // vivo Y03 4GB 64GB
    screen_size_inches: 6.56,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'MediaTek Helio G85',
    ram_gb: 4,
    storage_gb: 64,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 15,
    has_nfc: false,
    is_5g: false,
    weight_g: 186,
    available_colors: ['Gem Green', 'Space Black']
  },

  '6f54aac2-8c4b-4951-b584-452737906c15': { // vivo Y04 4GB 64GB
    screen_size_inches: 6.56,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'MediaTek Helio G85',
    ram_gb: 4,
    storage_gb: 64,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 15,
    has_nfc: false,
    is_5g: false,
    weight_g: 186,
    available_colors: ['Gem Green', 'Space Black', 'Aurora Purple']
  },

  '1cd6e1b1-5ff4-4f6e-ae96-bcc0fc4dcc18': { // vivo Y04 4GB 128GB
    screen_size_inches: 6.56,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'MediaTek Helio G85',
    ram_gb: 4,
    storage_gb: 128,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 15,
    has_nfc: false,
    is_5g: false,
    weight_g: 186,
    available_colors: ['Gem Green', 'Space Black', 'Aurora Purple']
  },

  '90f9aedc-b89e-4e60-8642-cf1970495a5b': { // vivo Y19s 6GB 128GB
    screen_size_inches: 6.68,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T612',
    ram_gb: 6,
    storage_gb: 128,
    main_camera_mp: 50,
    front_camera_mp: 5,
    battery_mah: 5500,
    charging_watt: 15,
    has_nfc: false,
    is_5g: false,
    weight_g: 198,
    available_colors: ['Glacier Blue', 'Titanium Gold']
  },

  '2c69623c-fa6a-4927-9ead-7447a05254fd': { // vivo Y21d 6GB 256GB
    screen_size_inches: 6.51,
    display_type: 'IPS LCD',
    refresh_rate_hz: 60,
    chipset: 'MediaTek Helio P35',
    ram_gb: 6,
    storage_gb: 256,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 10,
    has_nfc: false,
    is_5g: false,
    weight_g: 182,
    available_colors: ['Midnight Blue', 'Diamond Glow']
  },

  'ed5fa874-db5b-440d-953e-01acadf2593d': { // vivo V60 12GB 512GB
    screen_size_inches: 6.78,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 9300',
    ram_gb: 12,
    storage_gb: 512,
    main_camera_mp: 50,
    front_camera_mp: 50,
    battery_mah: 5000,
    charging_watt: 80,
    has_nfc: true,
    is_5g: true,
    weight_g: 193,
    available_colors: ['Noble Black', 'Breeze Blue', 'Pearl White']
  },

  '56e3cd14-1c6f-4575-90ff-08a1fcd057d9': { // vivo V40 Lite 8GB 256GB
    screen_size_inches: 6.67,
    display_type: 'AMOLED',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 6 Gen 1',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 32,
    battery_mah: 5000,
    charging_watt: 80,
    has_nfc: true,
    is_5g: true,
    weight_g: 188,
    available_colors: ['Titanium Silver', 'Ganges Blue']
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
  console.log('=== Populating Other Phone Brands Specs - Batch 2 ===');
  console.log(`Processing ${Object.keys(specsData).length} products\n`);

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
