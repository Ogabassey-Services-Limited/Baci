// Backfill script for product_key_specs
// Run with: npx tsx scripts/backfill-specs.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Researched specs from GSM Arena
const specsData = [
    { slug: 'infinix-zero-flip', screen: 6.9, refresh: 120, chipset: 'Dimensity 8020', ram: 8, storage: 512, camera: 64, battery: 4000, charge: 45, is5g: true, android: 13 },
    { slug: 'infinix-hot-50i-128gb-4gb', screen: 6.7, refresh: 120, chipset: 'Helio G81', ram: 4, storage: 128, camera: 48, battery: 5000, charge: 18, is5g: false, android: 14 },
    { slug: 'infinix-hot-50-pro-plus-256gb-8gb', screen: 6.78, refresh: 120, chipset: 'Helio G100', ram: 8, storage: 256, camera: 50, battery: 5000, charge: 33, is5g: false, android: 14 },
    { slug: 'infinix-hot-50', screen: 6.78, refresh: 120, chipset: 'Helio G100', ram: 8, storage: 256, camera: 50, battery: 5000, charge: 18, is5g: false, android: 14 },
    { slug: 'infinix-smart-9-hd-64gb-3gb', screen: 6.7, refresh: 90, chipset: 'Helio G50', ram: 3, storage: 64, camera: 13, battery: 5000, charge: 10, is5g: false, android: 14 },
    { slug: 'infinix-smart-9', screen: 6.7, refresh: 120, chipset: 'Helio G81', ram: 4, storage: 128, camera: 13, battery: 5000, charge: 10, is5g: false, android: 14 },
    { slug: 'infinix-smart-8', screen: 6.6, refresh: 90, chipset: 'Unisoc T606', ram: 4, storage: 128, camera: 13, battery: 5000, charge: 10, is5g: false, android: 13 },
    { slug: 'infinix-gt-30-pro-256gb-12gb', screen: 6.78, refresh: 144, chipset: 'Dimensity 8350', ram: 12, storage: 256, camera: 108, battery: 5500, charge: 45, is5g: true, android: 15 },
    { slug: 'infinix-xpad', screen: 11.0, refresh: 90, chipset: 'Helio G99', ram: 8, storage: 256, camera: 8, battery: 7000, charge: 18, is5g: false, android: 14 },
    { slug: 'infinix-hot-60i', screen: 6.7, refresh: 120, chipset: 'Helio G81 Ultimate', ram: 8, storage: 256, camera: 50, battery: 5160, charge: 45, is5g: false, android: 15 },
    { slug: 'infinix-hot-60-pro-plus', screen: 6.78, refresh: 144, chipset: 'Helio G200', ram: 8, storage: 256, camera: 50, battery: 5160, charge: 45, is5g: false, android: 15 },
    { slug: 'infinix-hot-60-pro-128gb-8gb', screen: 6.78, refresh: 144, chipset: 'Helio G200', ram: 8, storage: 128, camera: 50, battery: 5160, charge: 45, is5g: false, android: 15 },
    { slug: 'infinix-smart-10-64gb-3gb', screen: 6.67, refresh: 120, chipset: 'Unisoc T7250', ram: 3, storage: 64, camera: 8, battery: 5000, charge: 15, is5g: false, android: 15 },
    { slug: 'infinix-smart-10-hd-64gb-2gb', screen: 6.67, refresh: 90, chipset: 'Unisoc T7250', ram: 2, storage: 64, camera: 13, battery: 5000, charge: 10, is5g: false, android: 14 },
    { slug: 'infinix-smart-10-plus-128gb-4gb', screen: 6.67, refresh: 120, chipset: 'Unisoc T7250', ram: 4, storage: 128, camera: 8, battery: 6000, charge: 18, is5g: false, android: 15 },
    { slug: 'infinix-note-50-pro-plus-5g-256gb-12gb', screen: 6.78, refresh: 144, chipset: 'Dimensity 8350', ram: 12, storage: 256, camera: 50, battery: 5200, charge: 100, is5g: true, android: 15 },
    { slug: 'infinix-note-50-pro-256gb-8gb', screen: 6.78, refresh: 144, chipset: 'Helio G100 Ultimate', ram: 8, storage: 256, camera: 50, battery: 5200, charge: 90, is5g: false, android: 15 },
    { slug: 'infinix-note-50-256gb-8gb', screen: 6.78, refresh: 144, chipset: 'Helio G100 Ultimate', ram: 8, storage: 256, camera: 50, battery: 5200, charge: 45, is5g: false, android: 15 },
];

async function backfill() {
    console.log('Starting backfill...');

    for (const spec of specsData) {
        // Get product ID by slug
        const { data: product, error: pErr } = await supabase
            .from('products')
            .select('id')
            .eq('slug', spec.slug)
            .single();

        if (pErr || !product) {
            console.log(`Skipped ${spec.slug} - not found`);
            continue;
        }

        // Insert/upsert into product_key_specs
        const { error } = await supabase
            .from('product_key_specs')
            .upsert({
                product_id: product.id,
                screen_size_inches: spec.screen,
                refresh_rate_hz: spec.refresh,
                chipset: spec.chipset,
                ram_gb: spec.ram,
                storage_gb: spec.storage,
                main_camera_mp: spec.camera,
                battery_mah: spec.battery,
                charging_watt: spec.charge,
                is_5g: spec.is5g,
                android_version: spec.android,
            }, { onConflict: 'product_id' });

        if (error) {
            console.error(`Error for ${spec.slug}:`, error.message);
        } else {
            console.log(`✓ ${spec.slug}`);
        }
    }

    console.log('Done!');
}

backfill();
