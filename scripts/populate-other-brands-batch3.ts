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

// Batch 3: Final remaining products
const specsData: Record<string, Partial<KeySpecs>> = {
  // VIVO products (remaining)
  'de53d889-a1eb-41b5-9ffb-5e5d899ab634': { // vivo V50 Lite 8GB 256GB
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
    available_colors: ['Titanium Silver', 'Ganges Blue', 'Sunset Orange']
  },

  // ITEL products (remaining)
  'a9984c3b-d738-4405-8f75-5e5cf73c2557': { // itel play10 3GB 64GB
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 3,
    storage_gb: 64,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 10,
    has_nfc: false,
    is_5g: false,
    weight_g: 190,
    available_colors: ['Sky Blue', 'Starry Black']
  },

  '27474414-5199-43dd-ac55-91e7b447f38d': { // itel X5B 4GB 64GB
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 4,
    storage_gb: 64,
    main_camera_mp: 13,
    front_camera_mp: 5,
    battery_mah: 5000,
    charging_watt: 10,
    has_nfc: false,
    is_5g: false,
    weight_g: 190,
    available_colors: ['Sky Blue', 'Starry Black', 'Elegant White']
  },

  '857a11ff-41bd-4b18-87a5-4aadcb1f4984': { // itel X5bPlus 4GB 128GB
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 4,
    storage_gb: 128,
    main_camera_mp: 13,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 10,
    has_nfc: false,
    is_5g: false,
    weight_g: 190,
    available_colors: ['Sky Blue', 'Starry Black', 'Elegant White']
  },

  'a9dc29b5-7cc6-403b-9abe-2c14b33dc6cc': { // itel X6c 6GB 128GB
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 6,
    storage_gb: 128,
    main_camera_mp: 50,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 18,
    has_nfc: false,
    is_5g: false,
    weight_g: 195,
    available_colors: ['Sky Blue', 'Starry Black', 'Elegant White']
  },

  '8de9bca3-e216-45a5-badd-bf31aa062bac': { // itel X6c 6GB 256GB
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T606',
    ram_gb: 6,
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

  'a2cf036e-312b-4e98-a71d-8c6a9f14d409': { // itel X7c 8GB 256GB
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

  '4241120e-7e5b-4a23-9248-5dae2729c5b1': { // itel X9c 12GB 256GB
    screen_size_inches: 6.6,
    display_type: 'IPS LCD',
    refresh_rate_hz: 90,
    chipset: 'Unisoc T612',
    ram_gb: 12,
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

  // OPPO products (remaining)
  'a2fa012d-b1bd-4e4e-8aad-1feeee97296f': { // Oppo A5x (Budget Edition) 4GB/128GB
    screen_size_inches: 6.67,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 6s Gen 3',
    ram_gb: 4,
    storage_gb: 128,
    main_camera_mp: 50,
    front_camera_mp: 5,
    battery_mah: 5100,
    charging_watt: 45,
    has_nfc: false,
    is_5g: true,
    weight_g: 196,
    available_colors: ['Starry Purple', 'Starlight White']
  },

  'e9b7aa20-591a-4a1e-b768-b3e7bcd6bdcc': { // Oppo A5 Pro 8GB/256GB
    screen_size_inches: 6.7,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'MediaTek Dimensity 6300',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 8,
    battery_mah: 5000,
    charging_watt: 45,
    has_nfc: false,
    is_5g: true,
    weight_g: 189,
    available_colors: ['Starry Purple', 'Starlight White', 'Midnight Black']
  },

  '5e34c0be-bbb7-4916-88d9-58a6240fb9d4': { // Oppo A3 (2024) 8GB/256GB
    screen_size_inches: 6.67,
    display_type: 'IPS LCD',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 6s Gen 3',
    ram_gb: 8,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 5,
    battery_mah: 5100,
    charging_watt: 45,
    has_nfc: false,
    is_5g: true,
    weight_g: 196,
    available_colors: ['Starry Purple', 'Starlight White', 'Midnight Black']
  },

  '650450ac-51ce-4b96-82f4-46f27b9d57ce': { // Oppo A6 Pro 5G 8GB/256GB
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
    is_5g: true,
    weight_g: 189,
    available_colors: ['Starry Purple', 'Starlight White']
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
  console.log('=== Populating Other Phone Brands Specs - Batch 3 (Final) ===');
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
