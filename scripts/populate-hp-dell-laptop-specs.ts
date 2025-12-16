// HP + Dell Laptop Spec Scraper
// Populates product_key_specs for HP and Dell laptops
// Run with: npx tsx scripts/populate-hp-dell-laptop-specs.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface LaptopProduct {
    id: string;
    name: string;
    brand: string;
}

interface LaptopSpecs {
    product_id: string;
    screen_size_inches?: number;
    display_type?: string;
    display_resolution?: string;
    refresh_rate_hz?: number;
    chipset?: string;
    gpu?: string;
    ram_gb?: number;
    storage_gb?: number;
    battery_mah?: number;
    weight_g?: number;
    dimensions_mm?: string;
    has_headphone_jack?: boolean;
    fingerprint_type?: string;
}

// Helper to convert Wh to mAh (mAh ≈ Wh * 1000 / 11.4)
function whToMah(wh: number): number {
    return Math.round((wh * 1000) / 11.4);
}

// Sleep helper for rate limiting
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getLaptopsWithoutSpecs(): Promise<LaptopProduct[]> {
    console.log('🔍 Querying HP/Dell laptops without specs...\n');

    const { data, error } = await supabase
        .from('products')
        .select('id, name, brand')
        .ilike('category', '%laptop%')
        .or('brand.ilike.%hp%,brand.ilike.%dell%');

    if (error) {
        console.error('❌ Database error:', error);
        return [];
    }

    if (!data || data.length === 0) {
        console.log('No laptops found matching criteria');
        return [];
    }

    // Filter out ones that already have specs
    const filtered: LaptopProduct[] = [];
    for (const product of data) {
        const { data: existing } = await supabase
            .from('product_key_specs')
            .select('id')
            .eq('product_id', product.id)
            .single();

        if (!existing) {
            filtered.push(product);
        }
    }

    console.log(`Found ${filtered.length} laptops without specs:\n`);
    filtered.forEach((p, i) => {
        console.log(`${i + 1}. ${p.brand} - ${p.name} (${p.id})`);
    });
    console.log('');

    return filtered;
}

// Manual spec database - researched specs for common HP and Dell models
const MANUAL_SPECS: Record<string, Partial<LaptopSpecs>> = {
    // HP Pavilion Series
    'hp pavilion 15': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 8,
        storage_gb: 512,
        battery_mah: whToMah(41),
        weight_g: 1750,
        has_headphone_jack: true,
    },
    'hp pavilion 14': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(43),
        weight_g: 1410,
        has_headphone_jack: true,
    },
    // HP Envy Series
    'hp envy 13': {
        screen_size_inches: 13.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1255U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(51),
        weight_g: 1300,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp envy x360 15': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'AMD Ryzen 5 5625U',
        gpu: 'AMD Radeon Graphics',
        ram_gb: 8,
        storage_gb: 512,
        battery_mah: whToMah(51),
        weight_g: 1860,
        has_headphone_jack: true,
    },
    // HP Spectre Series
    'hp spectre x360 14': {
        screen_size_inches: 13.5,
        display_type: 'OLED',
        display_resolution: '3000x2000',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1255U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 1000,
        battery_mah: whToMah(66),
        weight_g: 1360,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    // HP EliteBook Series
    'hp elitebook 840 g9': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 256,
        battery_mah: whToMah(51),
        weight_g: 1360,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 850 g9': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1255U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1740,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    // HP ProBook Series
    'hp probook 450 g9': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(45),
        weight_g: 1740,
        has_headphone_jack: true,
    },
    // HP Omen (Gaming)
    'hp omen 16': {
        screen_size_inches: 16.1,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 165,
        chipset: 'Intel Core i7-12700H',
        gpu: 'NVIDIA GeForce RTX 3060',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(70),
        weight_g: 2320,
        has_headphone_jack: true,
    },
    'hp omen 17': {
        screen_size_inches: 17.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 144,
        chipset: 'Intel Core i7-12700H',
        gpu: 'NVIDIA GeForce RTX 3070',
        ram_gb: 16,
        storage_gb: 1000,
        battery_mah: whToMah(83),
        weight_g: 2780,
        has_headphone_jack: true,
    },
    // Dell Inspiron Series
    'dell inspiron 15 3000': {
        screen_size_inches: 15.6,
        display_type: 'TN',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i3-1115G4',
        gpu: 'Intel UHD Graphics',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(41),
        weight_g: 1850,
        has_headphone_jack: true,
    },
    'dell inspiron 15 5000': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 8,
        storage_gb: 512,
        battery_mah: whToMah(54),
        weight_g: 1710,
        has_headphone_jack: true,
    },
    'dell inspiron 14': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(54),
        weight_g: 1540,
        has_headphone_jack: true,
    },
    'dell inspiron 16': {
        screen_size_inches: 16,
        display_type: 'IPS',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1255U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(54),
        weight_g: 1870,
        has_headphone_jack: true,
    },
    // Dell XPS Series
    'dell xps 13': {
        screen_size_inches: 13.4,
        display_type: 'OLED',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1250U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(51),
        weight_g: 1170,
        has_headphone_jack: false,
        fingerprint_type: 'power button',
    },
    'dell xps 15': {
        screen_size_inches: 15.6,
        display_type: 'OLED',
        display_resolution: '3456x2160',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-12700H',
        gpu: 'NVIDIA GeForce RTX 3050 Ti',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(86),
        weight_g: 1990,
        has_headphone_jack: true,
        fingerprint_type: 'power button',
    },
    'dell xps 17': {
        screen_size_inches: 17,
        display_type: 'IPS',
        display_resolution: '3840x2400',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-12700H',
        gpu: 'NVIDIA GeForce RTX 3060',
        ram_gb: 32,
        storage_gb: 1000,
        battery_mah: whToMah(97),
        weight_g: 2210,
        has_headphone_jack: true,
        fingerprint_type: 'power button',
    },
    // Dell Latitude Series
    'dell latitude 5430': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1245U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 256,
        battery_mah: whToMah(58),
        weight_g: 1410,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'dell latitude 5530': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1245U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(64),
        weight_g: 1730,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    // Dell Precision (Workstation)
    'dell precision 3571': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-12700H',
        gpu: 'NVIDIA RTX A1000',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(68),
        weight_g: 1950,
        has_headphone_jack: true,
    },
    // Dell Alienware (Gaming)
    'dell alienware m15 r7': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 165,
        chipset: 'Intel Core i7-12700H',
        gpu: 'NVIDIA GeForce RTX 3060',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(86),
        weight_g: 2420,
        has_headphone_jack: true,
    },
    'dell alienware x17 r2': {
        screen_size_inches: 17.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 360,
        chipset: 'Intel Core i9-12900HK',
        gpu: 'NVIDIA GeForce RTX 3080 Ti',
        ram_gb: 32,
        storage_gb: 1000,
        battery_mah: whToMah(97),
        weight_g: 3090,
        has_headphone_jack: true,
    },
    // HP EliteBook x360 Series
    'hp elitebook x360 1040 g11': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core Ultra 7 165U',
        gpu: 'Intel Arc Graphics',
        ram_gb: 32,
        storage_gb: 512,
        battery_mah: whToMah(68),
        weight_g: 1360,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    // HP Victus Gaming Series
    'hp victus 15': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 144,
        chipset: 'AMD Ryzen 5 7535HS',
        gpu: 'NVIDIA GeForce RTX 4050',
        ram_gb: 8,
        storage_gb: 512,
        battery_mah: whToMah(70),
        weight_g: 2290,
        has_headphone_jack: true,
    },
    // HP ZBook Series
    'hp zbook firefly 14 g11': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core Ultra 7 165U',
        gpu: 'Intel Arc Graphics',
        ram_gb: 32,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1350,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    // HP Laptop 15 Series
    'hp laptop 15': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(41),
        weight_g: 1690,
        has_headphone_jack: true,
    },
    // HP 15 Series
    'hp 15': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i3-1215U',
        gpu: 'Intel UHD Graphics',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(41),
        weight_g: 1690,
        has_headphone_jack: true,
    },
    // HP OMEN MAX Series
    'hp omen max 16': {
        screen_size_inches: 16,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 165,
        chipset: 'Intel Core i9-14900HX',
        gpu: 'NVIDIA GeForce RTX 4080',
        ram_gb: 32,
        storage_gb: 1000,
        battery_mah: whToMah(83),
        weight_g: 2440,
        has_headphone_jack: true,
    },
    // Dell Vostro Series
    'dell vostro 3530': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1355U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(41),
        weight_g: 1660,
        has_headphone_jack: true,
    },
    // Dell Latitude 3000 Series
    'dell latitude 3520': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1135G7',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(42),
        weight_g: 1770,
        has_headphone_jack: true,
    },
    'dell latitude 3400': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-8265U',
        gpu: 'Intel UHD Graphics 620',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(42),
        weight_g: 1550,
        has_headphone_jack: true,
    },
    // Dell G-Series Gaming
    'dell g15 5530': {
        screen_size_inches: 15.6,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 120,
        chipset: 'Intel Core i5-13450HX',
        gpu: 'NVIDIA GeForce RTX 3050',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 2650,
        has_headphone_jack: true,
    },
    'dell g16 7640': {
        screen_size_inches: 16,
        display_type: 'IPS',
        display_resolution: '2560x1600',
        refresh_rate_hz: 165,
        chipset: 'Intel Core i7-13650HX',
        gpu: 'NVIDIA GeForce RTX 4060',
        ram_gb: 16,
        storage_gb: 1000,
        battery_mah: whToMah(86),
        weight_g: 2870,
        has_headphone_jack: true,
    },
    // Dell Alienware Gaming
    'dell alienware m16 r3': {
        screen_size_inches: 16,
        display_type: 'IPS',
        display_resolution: '2560x1600',
        refresh_rate_hz: 240,
        chipset: 'Intel Core Ultra 9 185H',
        gpu: 'NVIDIA GeForce RTX 5070 Ti',
        ram_gb: 32,
        storage_gb: 1000,
        battery_mah: whToMah(90),
        weight_g: 3000,
        has_headphone_jack: true,
    },
    'dell alienware m18 r3': {
        screen_size_inches: 18,
        display_type: 'IPS',
        display_resolution: '2560x1600',
        refresh_rate_hz: 165,
        chipset: 'Intel Core i9-14900HX',
        gpu: 'NVIDIA GeForce RTX 5080',
        ram_gb: 64,
        storage_gb: 2000,
        battery_mah: whToMah(97),
        weight_g: 3860,
        has_headphone_jack: true,
    },
    // HP EliteBook 1030/1040 Series
    'hp elitebook 1030 g2 x360': {
        screen_size_inches: 13.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-7200U',
        gpu: 'Intel HD Graphics 620',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(46),
        weight_g: 1280,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1030 g3 x360': {
        screen_size_inches: 13.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-8650U',
        gpu: 'Intel UHD Graphics 620',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1280,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1030 g4 x360': {
        screen_size_inches: 13.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-8565U',
        gpu: 'Intel UHD Graphics 620',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1330,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1030 g7 x360': {
        screen_size_inches: 13.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-10710U',
        gpu: 'Intel UHD Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1260,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1040 g6 x360': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-8265U',
        gpu: 'Intel UHD Graphics 620',
        ram_gb: 16,
        storage_gb: 256,
        battery_mah: whToMah(56),
        weight_g: 1350,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1040 g7 x360': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-10710U',
        gpu: 'Intel UHD Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1360,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1040 g8': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1185G7',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1350,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1040 g9': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-1235U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(51),
        weight_g: 1380,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 1040 g10': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1355U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(68),
        weight_g: 1360,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    // HP EliteBook 640/660 G11 Series
    'hp elitebook 640 g11': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core Ultra 5 125U',
        gpu: 'Intel Arc Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(51),
        weight_g: 1380,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 660 g11': {
        screen_size_inches: 16,
        display_type: 'IPS',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core Ultra 7 155H',
        gpu: 'NVIDIA GeForce RTX 2050',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(76),
        weight_g: 1900,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    // HP EliteBook 830/840 Series (older generations)
    'hp elitebook 830 g6 x360': {
        screen_size_inches: 13.3,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-8265U',
        gpu: 'Intel UHD Graphics 620',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(56),
        weight_g: 1350,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 840 g3': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-6300U',
        gpu: 'Intel HD Graphics 520',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(46),
        weight_g: 1450,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 840 g4': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-7200U',
        gpu: 'Intel HD Graphics 620',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(46),
        weight_g: 1440,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 840 g6': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i5-8265U',
        gpu: 'Intel UHD Graphics 620',
        ram_gb: 8,
        storage_gb: 256,
        battery_mah: whToMah(56),
        weight_g: 1450,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 840 g7': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-10710U',
        gpu: 'Intel UHD Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1380,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 840 g8': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1080',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1185G7',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 16,
        storage_gb: 512,
        battery_mah: whToMah(56),
        weight_g: 1360,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
    'hp elitebook 840 g10': {
        screen_size_inches: 14,
        display_type: 'IPS',
        display_resolution: '1920x1200',
        refresh_rate_hz: 60,
        chipset: 'Intel Core i7-1355U',
        gpu: 'Intel Iris Xe Graphics',
        ram_gb: 32,
        storage_gb: 1000,
        battery_mah: whToMah(51),
        weight_g: 1360,
        has_headphone_jack: true,
        fingerprint_type: 'side',
    },
};

function findManualSpecs(productName: string): Partial<LaptopSpecs> | null {
    const normalized = productName.toLowerCase();

    // Try exact match first
    for (const [key, specs] of Object.entries(MANUAL_SPECS)) {
        if (normalized.includes(key)) {
            return specs;
        }
    }

    // Try partial matches - HP models
    if (normalized.includes('pavilion 15')) return MANUAL_SPECS['hp pavilion 15'];
    if (normalized.includes('pavilion 14')) return MANUAL_SPECS['hp pavilion 14'];
    if (normalized.includes('envy 13')) return MANUAL_SPECS['hp envy 13'];
    if (normalized.includes('envy x360 15') || normalized.includes('envy 15')) return MANUAL_SPECS['hp envy x360 15'];
    if (normalized.includes('spectre')) return MANUAL_SPECS['hp spectre x360 14'];
    if (normalized.includes('elitebook x360 1040')) return MANUAL_SPECS['hp elitebook x360 1040 g11'];
    if (normalized.includes('elitebook 840')) return MANUAL_SPECS['hp elitebook 840 g9'];
    if (normalized.includes('elitebook 850')) return MANUAL_SPECS['hp elitebook 850 g9'];
    if (normalized.includes('probook')) return MANUAL_SPECS['hp probook 450 g9'];
    if (normalized.includes('victus 15')) return MANUAL_SPECS['hp victus 15'];
    if (normalized.includes('zbook firefly 14')) return MANUAL_SPECS['hp zbook firefly 14 g11'];
    if (normalized.includes('omen max 16')) return MANUAL_SPECS['hp omen max 16'];
    if (normalized.includes('omen 16')) return MANUAL_SPECS['hp omen 16'];
    if (normalized.includes('omen 17')) return MANUAL_SPECS['hp omen 17'];
    if (normalized.includes('laptop 15')) return MANUAL_SPECS['hp laptop 15'];
    if (normalized.includes('hp 15')) return MANUAL_SPECS['hp 15'];

    // Dell models
    if (normalized.includes('vostro 3530')) return MANUAL_SPECS['dell vostro 3530'];
    if (normalized.includes('inspiron 15 3')) return MANUAL_SPECS['dell inspiron 15 3000'];
    if (normalized.includes('inspiron 15 5') || normalized.includes('inspiron 15')) return MANUAL_SPECS['dell inspiron 15 5000'];
    if (normalized.includes('inspiron 14')) return MANUAL_SPECS['dell inspiron 14'];
    if (normalized.includes('inspiron 16')) return MANUAL_SPECS['dell inspiron 16'];
    if (normalized.includes('xps 13')) return MANUAL_SPECS['dell xps 13'];
    if (normalized.includes('xps 15')) return MANUAL_SPECS['dell xps 15'];
    if (normalized.includes('xps 17')) return MANUAL_SPECS['dell xps 17'];
    if (normalized.includes('latitude 3400')) return MANUAL_SPECS['dell latitude 3400'];
    if (normalized.includes('latitude 3520')) return MANUAL_SPECS['dell latitude 3520'];
    if (normalized.includes('latitude 5430')) return MANUAL_SPECS['dell latitude 5430'];
    if (normalized.includes('latitude 5530') || normalized.includes('latitude 5300') || normalized.includes('latitude')) return MANUAL_SPECS['dell latitude 5530'];
    if (normalized.includes('precision')) return MANUAL_SPECS['dell precision 3571'];
    if (normalized.includes('alienware m15')) return MANUAL_SPECS['dell alienware m15 r7'];
    if (normalized.includes('alienware x17') || normalized.includes('alienware 17')) return MANUAL_SPECS['dell alienware x17 r2'];

    return null;
}

async function insertSpecs(specs: LaptopSpecs): Promise<boolean> {
    const { error } = await supabase
        .from('product_key_specs')
        .upsert(specs, { onConflict: 'product_id' });

    if (error) {
        console.error(`   ❌ Database error:`, error.message);
        return false;
    }

    return true;
}

async function processLaptop(product: LaptopProduct, index: number, total: number): Promise<boolean> {
    console.log(`\n[${index + 1}/${total}] Processing: ${product.brand} - ${product.name}`);

    // Try manual specs first
    const manualSpecs = findManualSpecs(product.name);

    if (manualSpecs) {
        console.log(`   ✓ Found manual specs`);
        const specs: LaptopSpecs = {
            product_id: product.id,
            ...manualSpecs,
        };

        const success = await insertSpecs(specs);
        if (success) {
            console.log(`   ✅ Inserted specs successfully`);
            return true;
        }
        return false;
    }

    console.log(`   ⚠️  No manual specs found - skipping (add to manual database)`);
    return false;
}

async function main() {
    console.log('🚀 HP + Dell Laptop Spec Scraper\n');
    console.log('=' .repeat(60) + '\n');

    const laptops = await getLaptopsWithoutSpecs();

    if (laptops.length === 0) {
        console.log('✅ All HP/Dell laptops already have specs!');
        return;
    }

    console.log(`📋 Processing ${laptops.length} laptops...\n`);
    console.log('=' .repeat(60));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < laptops.length; i++) {
        const success = await processLaptop(laptops[i], i, laptops.length);

        if (success) {
            successCount++;
        } else {
            failCount++;
        }

        // Rate limiting: wait 3 seconds between requests
        if (i < laptops.length - 1) {
            await sleep(3000);
        }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total: ${laptops.length}\n`);

    if (failCount > 0) {
        console.log('⚠️  Some laptops were skipped. Add them to MANUAL_SPECS and re-run.');
    }
}

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
