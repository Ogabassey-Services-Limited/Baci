import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ------------------------------------------------------------------
// 1. IPHONE_SPECS: Full EAV Data
// ------------------------------------------------------------------
const IPHONE_SPECS: Record<string, {
    display: string;
    processor: string;
    camera: string;
    battery: string;
    os: string;
    colors: string[];
    features: string[];
    releaseYear: number;
}> = {
    // === iPhone 12 Series (2020) ===
    '12 Pro': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A14 Bionic',
        camera: '12MP Wide + 12MP Ultra Wide + 12MP 2x Tele + LiDAR | 12MP TrueDepth',
        battery: '2815mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 14 (Upgradable to iOS 18)',
        colors: ['Graphite', 'Silver', 'Gold', 'Pacific Blue'],
        features: ['5G', 'Ceramic Shield', 'ProRAW', 'LiDAR Scanner'],
        releaseYear: 2020
    },
    '12 Pro Max': {
        display: '6.7" Super Retina XDR OLED',
        processor: 'A14 Bionic',
        camera: '12MP Wide (Sensor Shift OIS) + 12MP Ultra Wide + 12MP 2.5x Tele + LiDAR | 12MP TrueDepth',
        battery: '3687mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 14 (Upgradable to iOS 18)',
        colors: ['Graphite', 'Silver', 'Gold', 'Pacific Blue'],
        features: ['5G', 'Sensor Shift OIS', 'ProRAW', 'LiDAR Scanner'],
        releaseYear: 2020
    },

    // === iPhone 13 Series (2021) ===
    '13': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A15 Bionic',
        camera: '12MP Wide + 12MP Ultra Wide | 12MP TrueDepth',
        battery: '3240mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 15 (Upgradable to iOS 18)',
        colors: ['Starlight', 'Midnight', 'Blue', 'Pink', 'Red', 'Green'],
        features: ['Cinematic Mode', 'Photographic Styles', 'A15 Bionic'],
        releaseYear: 2021
    },
    '13 Pro': {
        display: '6.1" Super Retina XDR ProMotion OLED (120Hz)',
        processor: 'A15 Bionic (5-core GPU)',
        camera: '12MP Wide + 12MP Ultra Wide + 12MP 3x Tele + LiDAR | 12MP TrueDepth',
        battery: '3095mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 15 (Upgradable to iOS 18)',
        colors: ['Graphite', 'Silver', 'Gold', 'Sierra Blue', 'Alpine Green'],
        features: ['ProMotion 120Hz', 'ProRAW/ProRes', 'LiDAR Scanner'],
        releaseYear: 2021
    },
    '13 Pro Max': {
        display: '6.7" Super Retina XDR ProMotion OLED (120Hz)',
        processor: 'A15 Bionic (5-core GPU)',
        camera: '12MP Wide + 12MP Ultra Wide + 12MP 3x Tele + LiDAR | 12MP TrueDepth',
        battery: '4352mAh, 27W Fast Charging, MagSafe',
        os: 'iOS 15 (Upgradable to iOS 18)',
        colors: ['Graphite', 'Silver', 'Gold', 'Sierra Blue', 'Alpine Green'],
        features: ['ProMotion 120Hz', 'ProRAW/ProRes', 'All-Day Battery'],
        releaseYear: 2021
    },

    // === iPhone 14 Series (2022) ===
    '14': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A15 Bionic (5-core GPU)',
        camera: '12MP Wide + 12MP Ultra Wide | 12MP TrueDepth',
        battery: '3279mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 16 (Upgradable to iOS 18)',
        colors: ['Midnight', 'Starlight', 'Blue', 'Purple', 'Red', 'Yellow'],
        features: ['Crash Detection', 'Emergency SOS via Satellite', 'Action Mode'],
        releaseYear: 2022
    },
    '14 Plus': {
        display: '6.7" Super Retina XDR OLED',
        processor: 'A15 Bionic (5-core GPU)',
        camera: '12MP Wide + 12MP Ultra Wide | 12MP TrueDepth',
        battery: '4325mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 16 (Upgradable to iOS 18)',
        colors: ['Midnight', 'Starlight', 'Blue', 'Purple', 'Red', 'Yellow'],
        features: ['Crash Detection', 'All-Day Battery', 'Action Mode'],
        releaseYear: 2022
    },
    '14 Pro': {
        display: '6.1" Super Retina XDR ProMotion Always-On OLED (120Hz)',
        processor: 'A16 Bionic',
        camera: '48MP Wide + 12MP Ultra Wide + 12MP 3x Tele + LiDAR | 12MP TrueDepth',
        battery: '3200mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 16 (Upgradable to iOS 18)',
        colors: ['Space Black', 'Silver', 'Gold', 'Deep Purple'],
        features: ['Dynamic Island', 'Always-On Display', '48MP Main Camera'],
        releaseYear: 2022
    },
    '14 Pro Max': {
        display: '6.7" Super Retina XDR ProMotion Always-On OLED (120Hz)',
        processor: 'A16 Bionic',
        camera: '48MP Wide + 12MP Ultra Wide + 12MP 3x Tele + LiDAR | 12MP TrueDepth',
        battery: '4323mAh, 27W Fast Charging, MagSafe',
        os: 'iOS 16 (Upgradable to iOS 18)',
        colors: ['Space Black', 'Silver', 'Gold', 'Deep Purple'],
        features: ['Dynamic Island', 'Always-On Display', '48MP Main Camera'],
        releaseYear: 2022
    },

    // === iPhone 15 Series (2023) ===
    '15': {
        display: '6.1" Super Retina XDR OLED (Dynamic Island)',
        processor: 'A16 Bionic',
        camera: '48MP Wide + 12MP Ultra Wide | 12MP TrueDepth',
        battery: '3349mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 17 (Upgradable to iOS 18)',
        colors: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'],
        features: ['Dynamic Island', 'USB-C', '48MP Camera', 'Roadside Assistance'],
        releaseYear: 2023
    },
    '15 Plus': {
        display: '6.7" Super Retina XDR OLED (Dynamic Island)',
        processor: 'A16 Bionic',
        camera: '48MP Wide + 12MP Ultra Wide | 12MP TrueDepth',
        battery: '4383mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 17 (Upgradable to iOS 18)',
        colors: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'],
        features: ['Dynamic Island', 'USB-C', 'All-Day Battery'],
        releaseYear: 2023
    },
    '15 Pro': {
        display: '6.1" Super Retina XDR ProMotion Always-On OLED (120Hz)',
        processor: 'A17 Pro',
        camera: '48MP Wide + 12MP Ultra Wide + 12MP 3x Tele + LiDAR | 12MP TrueDepth',
        battery: '3274mAh, 20W Fast Charging, MagSafe',
        os: 'iOS 17 (Upgradable to iOS 18)',
        colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
        features: ['Titanium Design', 'A17 Pro', 'USB 3', 'Action Button'],
        releaseYear: 2023
    },
    '15 Pro Max': {
        display: '6.7" Super Retina XDR ProMotion Always-On OLED (120Hz)',
        processor: 'A17 Pro',
        camera: '48MP Wide + 12MP Ultra Wide + 12MP 5x Tele + LiDAR | 12MP TrueDepth',
        battery: '4422mAh, 27W Fast Charging, MagSafe',
        os: 'iOS 17 (Upgradable to iOS 18)',
        colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'],
        features: ['Titanium Design', 'A17 Pro', '5x Optical Zoom', 'Action Button'],
        releaseYear: 2023
    },

    // === iPhone 16 Series (2024) ===
    '16E': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A18',
        camera: '48MP Wide | 12MP TrueDepth',
        battery: '3274mAh, 25W Fast Charging, MagSafe',
        os: 'iOS 18',
        colors: ['Black', 'White', 'Pink', 'Teal'],
        features: ['Apple Intelligence', 'Camera Control', 'USB-C'],
        releaseYear: 2024
    },
    '16': {
        display: '6.1" Super Retina XDR OLED',
        processor: 'A18',
        camera: '48MP Fusion + 12MP Ultra Wide | 12MP TrueDepth',
        battery: '3561mAh, 25W Fast Charging, MagSafe',
        os: 'iOS 18',
        colors: ['Black', 'White', 'Pink', 'Teal', 'Ultramarine'],
        features: ['Apple Intelligence', 'Camera Control', 'Action Button'],
        releaseYear: 2024
    },
    '16 Plus': {
        display: '6.7" Super Retina XDR OLED',
        processor: 'A18',
        camera: '48MP Fusion + 12MP Ultra Wide | 12MP TrueDepth',
        battery: '4674mAh, 25W Fast Charging, MagSafe',
        os: 'iOS 18',
        colors: ['Black', 'White', 'Pink', 'Teal', 'Ultramarine'],
        features: ['Apple Intelligence', 'Camera Control', 'All-Day Battery'],
        releaseYear: 2024
    },
    '16 Pro': {
        display: '6.3" Super Retina XDR ProMotion Always-On OLED (120Hz)',
        processor: 'A18 Pro',
        camera: '48MP Fusion + 48MP Ultra Wide + 12MP 5x Tele | 12MP TrueDepth',
        battery: '3582mAh, 25W Fast Charging, MagSafe',
        os: 'iOS 18',
        colors: ['Black Titanium', 'White Titanium', 'Natural Titanium', 'Desert Titanium'],
        features: ['A18 Pro', 'Camera Control', '4K 120fps ProRes'],
        releaseYear: 2024
    },
    '16 Pro Max': {
        display: '6.9" Super Retina XDR ProMotion Always-On OLED (120Hz)',
        processor: 'A18 Pro',
        camera: '48MP Fusion + 48MP Ultra Wide + 12MP 5x Tele | 12MP TrueDepth',
        battery: '4685mAh, 27W Fast Charging, MagSafe',
        os: 'iOS 18',
        colors: ['Black Titanium', 'White Titanium', 'Natural Titanium', 'Desert Titanium'],
        features: ['A18 Pro', 'Camera Control', 'Longest Battery Life'],
        releaseYear: 2024
    },

    // === iPhone 17 Series (2025) ===
    '17 Air': {
        display: '6.6" Super Retina XDR OLED',
        processor: 'A19',
        camera: '48MP Wide | 24MP TrueDepth',
        battery: '3100mAh, 25W Fast Charging, MagSafe',
        os: 'iOS 19',
        colors: ['Black', 'Starlight'],
        features: ['Ultra Thin 5.5mm', 'Apple Intelligence 2.0', 'A19 Chip'],
        releaseYear: 2025
    },
    '17': {
        display: '6.3" Super Retina XDR OLED',
        processor: 'A19',
        camera: '48MP Fusion + 12MP Ultra Wide | 24MP TrueDepth',
        battery: '3800mAh, 30W Fast Charging, MagSafe',
        os: 'iOS 19',
        colors: ['Black', 'White', 'Blue', 'Green'],
        features: ['Apple Intelligence 2.0', 'A19 Chip', 'Action Button'],
        releaseYear: 2025
    },
    '17 Pro': {
        display: '6.3" Super Retina XDR ProMotion Always-On OLED (120Hz)',
        processor: 'A19 Pro',
        camera: '48MP Wide + 48MP Ultra Wide + 12MP 5x Tele | 24MP TrueDepth',
        battery: '3900mAh, 35W Fast Charging, MagSafe',
        os: 'iOS 19',
        colors: ['Black Titanium', 'White Titanium', 'Natural Titanium', 'Bronze Titanium'],
        features: ['A19 Pro', '24MP Selfie', '8K Video Recording'],
        releaseYear: 2025
    },
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from Google Sheet)
// Note: Physical Sim = Physical + Esim for iPhone 14-17
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // === iPhone 12 (2020) - New Open Box ===
    { model: '12 Pro', ram: '6GB', storage: '128GB', price: 430000, condition: 'New Open Box' },
    { model: '12 Pro', ram: '6GB', storage: '256GB', price: 460000, condition: 'New Open Box' },
    { model: '12 Pro', ram: '6GB', storage: '512GB', price: 580000, condition: 'New Open Box' },
    { model: '12 Pro Max', ram: '6GB', storage: '128GB', price: 570000, condition: 'New Open Box' },
    { model: '12 Pro Max', ram: '6GB', storage: '256GB', price: 610000, condition: 'New Open Box' },
    { model: '12 Pro Max', ram: '6GB', storage: '512GB', price: 680000, condition: 'New Open Box' },

    // === iPhone 13 (2021) - New Open Box ===
    { model: '13', ram: '4GB', storage: '128GB', price: 460000, condition: 'New Open Box' },
    { model: '13', ram: '4GB', storage: '256GB', price: 500000, condition: 'New Open Box' },
    { model: '13 Pro', ram: '6GB', storage: '128GB', price: 590000, condition: 'New Open Box' },
    { model: '13 Pro', ram: '6GB', storage: '256GB', price: 640000, condition: 'New Open Box' },
    { model: '13 Pro', ram: '6GB', storage: '512GB', price: 700000, condition: 'New Open Box' },
    { model: '13 Pro Max', ram: '6GB', storage: '128GB', price: 680000, condition: 'New Open Box' },
    { model: '13 Pro Max', ram: '6GB', storage: '256GB', price: 730000, condition: 'New Open Box' },
    { model: '13 Pro Max', ram: '6GB', storage: '512GB', price: 760000, condition: 'New Open Box' },

    // === iPhone 14 (2022) - New Open Box ===
    { model: '14', ram: '6GB', storage: '128GB', price: 580000, simType: 'Esim', condition: 'New Open Box' },
    { model: '14', ram: '6GB', storage: '128GB', price: 560000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14', ram: '6GB', storage: '256GB', price: 730000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Plus', ram: '6GB', storage: '128GB', price: 730000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Plus', ram: '6GB', storage: '256GB', price: 760000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro', ram: '6GB', storage: '128GB', price: 910000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro', ram: '6GB', storage: '256GB', price: 970000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro', ram: '6GB', storage: '512GB', price: 1030000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro', ram: '6GB', storage: '1TB', price: 1100000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro Max', ram: '6GB', storage: '128GB', price: 1050000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro Max', ram: '6GB', storage: '256GB', price: 1140000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro Max', ram: '6GB', storage: '512GB', price: 1190000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '14 Pro Max', ram: '6GB', storage: '1TB', price: 1240000, simType: 'Physical + Esim', condition: 'New Open Box' },

    // === iPhone 15 (2023) - New Open Box ===
    { model: '15', ram: '6GB', storage: '128GB', price: 930000, simType: 'Esim', condition: 'New Open Box' },
    { model: '15', ram: '6GB', storage: '256GB', price: 1000000, simType: 'Esim', condition: 'New Open Box' },
    { model: '15', ram: '8GB', storage: '128GB', price: 870000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Plus', ram: '6GB', storage: '128GB', price: 1000000, simType: 'Esim', condition: 'New Open Box' },
    { model: '15 Plus', ram: '8GB', storage: '128GB', price: 1060000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Plus', ram: '8GB', storage: '256GB', price: 1300000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Plus', ram: '8GB', storage: '512GB', price: 1520000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Pro', ram: '8GB', storage: '128GB', price: 1100000, simType: 'Esim', condition: 'New Open Box' },
    { model: '15 Pro', ram: '8GB', storage: '256GB', price: 1150000, simType: 'Esim', condition: 'New Open Box' },
    { model: '15 Pro', ram: '8GB', storage: '128GB', price: 1190000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Pro', ram: '8GB', storage: '256GB', price: 1260000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Pro', ram: '8GB', storage: '512GB', price: 1320000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Pro', ram: '8GB', storage: '1TB', price: 1400000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Pro Max', ram: '8GB', storage: '256GB', price: 1400000, simType: 'Esim', condition: 'New Open Box' },
    { model: '15 Pro Max', ram: '8GB', storage: '512GB', price: 1320000, simType: 'Esim', condition: 'New Open Box' },
    { model: '15 Pro Max', ram: '8GB', storage: '256GB', price: 1700000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Pro Max', ram: '8GB', storage: '512GB', price: 1400000, simType: 'Physical + Esim', condition: 'New Open Box' },
    { model: '15 Pro Max', ram: '8GB', storage: '1TB', price: 2000000, simType: 'Physical + Esim', condition: 'New Open Box' },

    // === iPhone 16E (2024) - New ===
    { model: '16E', ram: '8GB', storage: '128GB', price: 850000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16E', ram: '8GB', storage: '256GB', price: 1110000, simType: 'Physical + Esim', condition: 'New' },

    // === iPhone 16 (2024) - New ===
    { model: '16', ram: '8GB', storage: '128GB', price: 900000, simType: 'Esim', condition: 'New' },
    { model: '16', ram: '8GB', storage: '256GB', price: 1090000, simType: 'Esim', condition: 'New' },
    { model: '16', ram: '8GB', storage: '512GB', price: 1450000, simType: 'Esim', condition: 'New' },
    { model: '16', ram: '8GB', storage: '128GB', price: 960000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16', ram: '8GB', storage: '256GB', price: 1120000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16', ram: '8GB', storage: '512GB', price: 1580000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Plus', ram: '8GB', storage: '128GB', price: 960000, simType: 'Esim', condition: 'New' },
    { model: '16 Plus', ram: '8GB', storage: '512GB', price: 1590000, simType: 'Esim', condition: 'New' },
    { model: '16 Plus', ram: '8GB', storage: '128GB', price: 1060000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Plus', ram: '8GB', storage: '256GB', price: 1390000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Plus', ram: '8GB', storage: '512GB', price: 1700000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro', ram: '8GB', storage: '128GB', price: 1500000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro', ram: '8GB', storage: '256GB', price: 1700000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro', ram: '8GB', storage: '512GB', price: 2030000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro', ram: '8GB', storage: '1TB', price: 2330000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro', ram: '8GB', storage: '512GB', price: 1730000, simType: 'Esim', condition: 'New' },
    { model: '16 Pro', ram: '8GB', storage: '1TB', price: 1600000, simType: 'Esim', condition: 'New' },
    { model: '16 Pro Max', ram: '8GB', storage: '256GB', price: 1750000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro Max', ram: '8GB', storage: '512GB', price: 2020000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro Max', ram: '8GB', storage: '1TB', price: 2480000, simType: 'Physical + Esim', condition: 'New' },
    { model: '16 Pro Max', ram: '8GB', storage: '256GB', price: 1450000, simType: 'Esim', condition: 'New' },
    { model: '16 Pro Max', ram: '8GB', storage: '512GB', price: 1700000, simType: 'Esim', condition: 'New' },
    { model: '16 Pro Max', ram: '8GB', storage: '1TB', price: 1800000, simType: 'Esim', condition: 'New' },

    // === iPhone 17 (2025) - New ===
    { model: '17 Air', ram: '8GB', storage: '256GB', price: 1350000, condition: 'New' },
    { model: '17 Air', ram: '8GB', storage: '512GB', price: 1580000, condition: 'New' },
    { model: '17 Air', ram: '8GB', storage: '1TB', price: 1780000, condition: 'New' },
    { model: '17', ram: '8GB', storage: '256GB', price: 1300000, simType: 'Esim', condition: 'New' },
    { model: '17', ram: '8GB', storage: '256GB', price: 1350000, simType: 'Physical + Esim', condition: 'New' },
    { model: '17 Pro', ram: '8GB', storage: '256GB', price: 1680000, simType: 'Esim', condition: 'New' },
    { model: '17 Pro', ram: '8GB', storage: '512GB', price: 1800000, simType: 'Esim', condition: 'New' },
    { model: '17 Pro', ram: '8GB', storage: '1TB', price: 2200000, simType: 'Esim', condition: 'New' },
    { model: '17 Pro', ram: '8GB', storage: '256GB', price: 1900000, simType: 'Physical + Esim', condition: 'New' },
    { model: '17 Pro', ram: '8GB', storage: '512GB', price: 2250000, simType: 'Physical + Esim', condition: 'New' },
    { model: '17 Pro', ram: '8GB', storage: '1TB', price: 2580000, simType: 'Physical + Esim', condition: 'New' },
];

// ------------------------------------------------------------------
// 3. DESCRIPTION GENERATOR (Full EAV + BNPL + Open Box Strategy)
// ------------------------------------------------------------------
function generateDescription(
    model: string,
    fullName: string,
    price: number,
    specs: any,
    metadata: any
) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);
    const monthlyPayment = Math.ceil(price / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);
    const condition = metadata.condition || 'New';

    let description = `## iPhone ${model} Price in Nigeria\n\n`;
    description += `The **${fullName}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;
    description += `Powered by the **${specs.processor}** chip with stunning **${specs.display}** and advanced **${specs.camera.split(' | ')[0]}** camera system.`;

    // Open Box explanation  
    if (condition === 'New Open Box') {
        description += `\n\n## Condition: New Open Box (Grade A+)\n\n`;
        description += `This device is in **factory-fresh condition** with zero usage:\n`;
        description += `- ✅ **Never Activated:** iPhone has never been used or activated\n`;
        description += `- ✅ **Original Packaging:** Box opened only for quality inspection\n`;
        description += `- ✅ **Full Accessories:** Charger, cable, and documentation included\n`;
        description += `- ✅ **Manufacturer Warranty:** Full Apple warranty applies\n`;
        description += `- ✅ **99%+ Condition:** No scratches, dents, or wear marks\n`;
        description += `- ⚠️ **Why Open Box:** Customer returns (unopened) or display units (unused)\n`;
    }

    description += `\n\n## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | iPhone ${model} |
| **Price** | ${priceStr} |
| **Condition** | ${condition} |`;

    if (metadata.ram) description += `\n| **RAM** | ${metadata.ram} |`;
    if (metadata.storage) description += `\n| **Storage** | ${metadata.storage} |`;
    if (metadata.simType) description += `\n| **SIM Type** | ${metadata.simType} |`;
    description += `\n| **Display** | ${specs.display} |`;
    description += `\n| **Processor** | ${specs.processor} |`;
    description += `\n| **Camera** | ${specs.camera} |`;
    description += `\n| **Battery** | ${specs.battery} |`;
    description += `\n| **OS** | ${specs.os} |`;
    description += `\n| **Features** | ${specs.features.join(', ')} |`;
    description += `\n| **Colors** | ${specs.colors.join(', ')} |`;

    description += `

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR **₦${monthlyPayment.toLocaleString()}/month × 10** (BNPL)
- ✅ **Guaranteed Quality:** ${condition === 'New Open Box' ? 'Factory-Fresh Open Box with Full Warranty' : 'Brand New (Sealed)'}
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Samsung Galaxy S25 Ultra](/ogabassey/samsung) - Android Alternative
- [Google Pixel 9 Pro](/ogabassey/google) - Pixel Alternative
- [iPhone 16 Pro Max](/ogabassey/apple) - Latest iPhone
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedIphones() {
    console.log("📱 Starting iPhone Import with Full EAV Specs...\n");

    // Get Apple category
    const { data: appleCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'apple').single();
    if (!appleCat) {
        console.error("❌ 'Apple' category not found.");
        return;
    }
    const merchantId = appleCat.merchant_id;
    const categoryId = appleCat.id;

    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} iPhone products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = IPHONE_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs for iPhone ${p.model}, skipping.`);
            continue;
        }

        // Build full name with SIM type
        let fullName = `iPhone ${p.model} ${p.ram} ${p.storage}`;
        if ((p as any).simType) fullName += ` ${(p as any).simType}`;
        fullName += ` (${p.condition})`;

        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            skipped++;
            continue;
        }

        const metadata: any = {
            brand: 'Apple',
            model: `iPhone ${p.model}`,
            ram: p.ram,
            storage: p.storage,
            condition: p.condition,
            releaseYear: specs.releaseYear,
            simType: (p as any).simType || null,
        };

        const description = generateDescription(p.model, fullName, p.price, specs, metadata);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      Price: ₦${p.price.toLocaleString()} | Condition: ${p.condition}`);

        // Map condition: New Open Box -> 'used' (RefurbishedCondition in schema)
        const dbCondition = p.condition === 'New Open Box' ? 'used' : 'new';

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.85),
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Apple',
            status: 'active',
            stock: 5,
            condition: dbCondition,
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n🏁 iPhone Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedIphones();
