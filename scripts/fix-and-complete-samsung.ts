/**
 * Fix storage extraction and complete Samsung spec population
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SpecData {
  product_id: string;
  screen_size_inches: number | null;
  display_type: string | null;
  refresh_rate_hz: number | null;
  chipset: string | null;
  ram_gb: number | null;
  storage_gb: number | null;
  main_camera_mp: number | null;
  front_camera_mp: number | null;
  has_ois: boolean;
  has_triple_camera: boolean;
  has_quad_camera: boolean;
  battery_mah: number | null;
  charging_watt: number | null;
  has_wireless_charging: boolean;
  has_reverse_charging: boolean;
  has_nfc: boolean;
  is_5g: boolean;
  weight_g: number | null;
  ip_rating: string | null;
}

// Additional specs for missing products
const additionalSpecs: Record<string, Partial<SpecData>> = {
  'Samsung Galaxy S24': {
    screen_size_inches: 6.2,
    display_type: 'Dynamic AMOLED 2X',
    refresh_rate_hz: 120,
    chipset: 'Exynos 2400',
    ram_gb: 8,
    storage_gb: 128,
    main_camera_mp: 50,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    has_quad_camera: false,
    battery_mah: 4000,
    charging_watt: 25,
    has_wireless_charging: true,
    has_reverse_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 168,
    ip_rating: 'IP68',
  },
  'Samsung Galaxy S25': {
    screen_size_inches: 6.2,
    display_type: 'Dynamic AMOLED 2X',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 3',
    ram_gb: 12,
    storage_gb: 256,
    main_camera_mp: 50,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: true,
    has_quad_camera: false,
    battery_mah: 4000,
    charging_watt: 25,
    has_wireless_charging: true,
    has_reverse_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 167,
    ip_rating: 'IP68',
  },
  'Samsung Galaxy S25 Ultra': {
    screen_size_inches: 6.9,
    display_type: 'Dynamic AMOLED 2X',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 3',
    ram_gb: 12,
    storage_gb: 1024,
    main_camera_mp: 200,
    front_camera_mp: 12,
    has_ois: true,
    has_triple_camera: false,
    has_quad_camera: true,
    battery_mah: 5000,
    charging_watt: 45,
    has_wireless_charging: true,
    has_reverse_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 232,
    ip_rating: 'IP68',
  },
  'Samsung Galaxy Z Fold 6': {
    screen_size_inches: 7.6,
    display_type: 'Dynamic AMOLED 2X',
    refresh_rate_hz: 120,
    chipset: 'Snapdragon 8 Gen 3',
    ram_gb: 12,
    storage_gb: 1024,
    main_camera_mp: 50,
    front_camera_mp: 10,
    has_ois: true,
    has_triple_camera: true,
    has_quad_camera: false,
    battery_mah: 4400,
    charging_watt: 25,
    has_wireless_charging: true,
    has_reverse_charging: true,
    has_nfc: true,
    is_5g: true,
    weight_g: 239,
    ip_rating: 'IPX8',
  },
};

function normalizeProductName(name: string): string {
  return name
    .replace(/\s*\d+GB\s*\d+GB/gi, '')
    .replace(/\s*\d+GB\s*/gi, ' ')
    .replace(/\s*\(Open Box\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRAMStorage(productName: string): { ram: number | null; storage: number | null } {
  // Pattern: "8GB 128GB" or "12GB 512GB"
  const match = productName.match(/(\d+)GB\s+(\d+)GB/i);
  if (match) {
    return {
      ram: parseInt(match[1]),
      storage: parseInt(match[2]),
    };
  }

  // Fallback: just GB without clear pattern
  const gbMatches = productName.match(/\b(\d+)GB\b/gi);
  if (gbMatches && gbMatches.length >= 2) {
    return {
      ram: parseInt(gbMatches[0]),
      storage: parseInt(gbMatches[1]),
    };
  }

  return { ram: null, storage: null };
}

async function updateExistingSpecs() {
  console.log('🔧 Fixing storage_gb values for existing specs...\n');

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .ilike('brand', '%samsung%');

  if (!products) return;

  let updateCount = 0;

  for (const product of products) {
    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (!spec) continue;

    const { ram, storage } = extractRAMStorage(product.name);

    // Update if storage needs correction
    if (storage && spec.storage_gb !== storage) {
      const { error } = await supabase
        .from('product_key_specs')
        .update({
          ram_gb: ram || spec.ram_gb,
          storage_gb: storage,
        })
        .eq('product_id', product.id);

      if (!error) {
        console.log(`✅ Updated ${product.name}: ${ram}GB RAM / ${storage}GB storage`);
        updateCount++;
      }
    }
  }

  console.log(`\n📊 Updated ${updateCount} records\n`);
}

async function insertMissingSpecs() {
  console.log('📝 Inserting specs for remaining products...\n');

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .ilike('brand', '%samsung%')
    .ilike('category', '%phone%');

  if (!products) return;

  let insertCount = 0;

  for (const product of products) {
    // Check if specs exist
    const { data: existingSpec } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .single();

    if (existingSpec) continue;

    // Skip non-phone items
    if (product.name.includes('Smart Tag') || product.name.includes('Fit 3')) {
      console.log(`⏭️  Skipping ${product.name} (not a phone)`);
      continue;
    }

    const normalized = normalizeProductName(product.name);
    let specs: Partial<SpecData> | null = null;

    // Find matching specs
    for (const [model, modelSpecs] of Object.entries(additionalSpecs)) {
      if (normalized.includes(normalizeProductName(model))) {
        specs = modelSpecs;
        break;
      }
    }

    if (!specs) {
      console.log(`⚠️  No specs found for ${product.name}`);
      continue;
    }

    // Extract RAM/storage from name
    const { ram, storage } = extractRAMStorage(product.name);

    const specData: SpecData = {
      product_id: product.id,
      screen_size_inches: specs.screen_size_inches ?? null,
      display_type: specs.display_type ?? null,
      refresh_rate_hz: specs.refresh_rate_hz ?? null,
      chipset: specs.chipset ?? null,
      ram_gb: ram ?? specs.ram_gb ?? null,
      storage_gb: storage ?? specs.storage_gb ?? null,
      main_camera_mp: specs.main_camera_mp ?? null,
      front_camera_mp: specs.front_camera_mp ?? null,
      has_ois: specs.has_ois ?? false,
      has_triple_camera: specs.has_triple_camera ?? false,
      has_quad_camera: specs.has_quad_camera ?? false,
      battery_mah: specs.battery_mah ?? null,
      charging_watt: specs.charging_watt ?? null,
      has_wireless_charging: specs.has_wireless_charging ?? false,
      has_reverse_charging: specs.has_reverse_charging ?? false,
      has_nfc: specs.has_nfc ?? false,
      is_5g: specs.is_5g ?? false,
      weight_g: specs.weight_g ?? null,
      ip_rating: specs.ip_rating ?? null,
    };

    const { error } = await supabase
      .from('product_key_specs')
      .insert(specData);

    if (error) {
      console.error(`❌ Error inserting ${product.name}:`, error.message);
    } else {
      console.log(`✅ Inserted ${product.name}`);
      insertCount++;
    }
  }

  console.log(`\n📊 Inserted ${insertCount} new records\n`);
}

async function main() {
  console.log('🚀 Samsung Spec Fix & Complete\n');
  console.log('='.repeat(50));
  console.log('');

  await updateExistingSpecs();
  await insertMissingSpecs();

  console.log('✅ Complete!');
}

main().catch(console.error);
