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
// 1. SAMSUNG_FLAGSHIP_SPECS: Full EAV Data
// ------------------------------------------------------------------
const SAMSUNG_FLAGSHIP_SPECS: Record<string, {
    display: string;
    processor: string;
    camera: string;
    battery: string;
    os: string;
    colors: string[];
    features: string[];
    series: 'S' | 'Flip' | 'Fold';
    releaseYear: number;
}> = {
    // === S20 SERIES (2020) ===
    'S20 Plus': {
        display: '6.7" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 990 / Snapdragon 865',
        camera: '64MP Wide + 12MP UW + 12MP Tele | 10MP Front',
        battery: '4500mAh, 25W Fast Charging',
        os: 'Android 10 (Upgradable to 13)',
        colors: ['Cosmic Grey', 'Cloud Blue', 'Cosmic Black'],
        features: ['5G', '120Hz Display', 'Wireless PowerShare'],
        series: 'S',
        releaseYear: 2020
    },
    'S20 ULTRA': {
        display: '6.9" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 990 / Snapdragon 865',
        camera: '108MP Wide + 48MP 10x Tele + 12MP UW | 40MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 10 (Upgradable to 13)',
        colors: ['Cosmic Grey', 'Cosmic Black'],
        features: ['100x Space Zoom', '8K Video', '5G'],
        series: 'S',
        releaseYear: 2020
    },

    // === S21 SERIES (2021) ===
    'S21 FE': {
        display: '6.4" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2100 / Snapdragon 888',
        camera: '12MP Wide + 12MP UW + 8MP Tele | 32MP Front',
        battery: '4500mAh, 25W Fast Charging',
        os: 'Android 12 (Upgradable to 14)',
        colors: ['Olive', 'Lavender', 'White', 'Graphite'],
        features: ['120Hz AMOLED', 'IP68', 'Wireless Charging'],
        series: 'S',
        releaseYear: 2021
    },
    'S21': {
        display: '6.2" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2100 / Snapdragon 888',
        camera: '64MP Tele + 12MP Wide + 12MP UW | 10MP Front',
        battery: '4000mAh, 25W Fast Charging',
        os: 'Android 11 (Upgradable to 14)',
        colors: ['Phantom Grey', 'Phantom White', 'Phantom Violet', 'Phantom Pink'],
        features: ['120Hz AMOLED', '8K Video', '5G'],
        series: 'S',
        releaseYear: 2021
    },
    'S21 Plus': {
        display: '6.7" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2100 / Snapdragon 888',
        camera: '64MP Tele + 12MP Wide + 12MP UW | 10MP Front',
        battery: '4800mAh, 25W Fast Charging',
        os: 'Android 11 (Upgradable to 14)',
        colors: ['Phantom Silver', 'Phantom Black', 'Phantom Violet'],
        features: ['120Hz AMOLED', '8K Video', '5G', 'UWB'],
        series: 'S',
        releaseYear: 2021
    },
    'S21 Ultra': {
        display: '6.8" Dynamic AMOLED 2X (120Hz, 1500 nits)',
        processor: 'Exynos 2100 / Snapdragon 888',
        camera: '108MP Wide + 12MP UW + 10MP 10x Tele + 10MP 3x Tele | 40MP Front',
        battery: '5000mAh, 25W Fast Charging',
        os: 'Android 11 (Upgradable to 14)',
        colors: ['Phantom Black', 'Phantom Silver', 'Phantom Titanium'],
        features: ['S Pen Support', '100x Space Zoom', '8K Video'],
        series: 'S',
        releaseYear: 2021
    },

    // === S22 SERIES (2022) ===
    'S22': {
        display: '6.1" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2200 / Snapdragon 8 Gen 1',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 10MP Front',
        battery: '3700mAh, 25W Fast Charging',
        os: 'Android 12 (Upgradable to 14)',
        colors: ['Phantom Black', 'Phantom White', 'Green', 'Pink Gold'],
        features: ['120Hz AMOLED', 'Nightography', '8K Video'],
        series: 'S',
        releaseYear: 2022
    },
    'S22 Plus': {
        display: '6.6" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2200 / Snapdragon 8 Gen 1',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 10MP Front',
        battery: '4500mAh, 45W Fast Charging',
        os: 'Android 12 (Upgradable to 14)',
        colors: ['Phantom Black', 'Phantom White', 'Green', 'Pink Gold'],
        features: ['120Hz AMOLED', '45W Charging', 'Nightography'],
        series: 'S',
        releaseYear: 2022
    },
    'S22 Ultra': {
        display: '6.8" Dynamic AMOLED 2X (120Hz, 1750 nits)',
        processor: 'Exynos 2200 / Snapdragon 8 Gen 1',
        camera: '108MP Wide + 12MP UW + 10MP 10x Tele + 10MP 3x Tele | 40MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 12 (Upgradable to 14)',
        colors: ['Phantom Black', 'Phantom White', 'Green', 'Burgundy'],
        features: ['Built-in S Pen', '100x Space Zoom', '45W Charging'],
        series: 'S',
        releaseYear: 2022
    },

    // === S23 SERIES (2023) ===
    'S23 FE': {
        display: '6.4" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2200 / Snapdragon 8 Gen 1',
        camera: '50MP Wide + 12MP UW + 8MP 3x Tele | 10MP Front',
        battery: '4500mAh, 25W Fast Charging',
        os: 'Android 13 (Upgradable to 15)',
        colors: ['Mint', 'Cream', 'Graphite', 'Purple'],
        features: ['120Hz AMOLED', 'IP68', 'Nightography'],
        series: 'S',
        releaseYear: 2023
    },
    'S23': {
        display: '6.1" Dynamic AMOLED 2X (120Hz)',
        processor: 'Snapdragon 8 Gen 2 for Galaxy',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 12MP Front',
        battery: '3900mAh, 25W Fast Charging',
        os: 'Android 13 (Upgradable to 15)',
        colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'],
        features: ['Snapdragon for Galaxy', 'Nightography', '8K Video'],
        series: 'S',
        releaseYear: 2023
    },
    'S23+': {
        display: '6.6" Dynamic AMOLED 2X (120Hz)',
        processor: 'Snapdragon 8 Gen 2 for Galaxy',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 12MP Front',
        battery: '4700mAh, 45W Fast Charging',
        os: 'Android 13 (Upgradable to 15)',
        colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'],
        features: ['45W Charging', 'Nightography', 'Vision Booster'],
        series: 'S',
        releaseYear: 2023
    },
    'S23 Ultra': {
        display: '6.8" Dynamic AMOLED 2X (120Hz, 1750 nits)',
        processor: 'Snapdragon 8 Gen 2 for Galaxy',
        camera: '200MP Wide + 12MP UW + 10MP 10x Tele + 10MP 3x Tele | 12MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 13 (Upgradable to 15)',
        colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'],
        features: ['200MP Camera', 'Built-in S Pen', '100x Space Zoom'],
        series: 'S',
        releaseYear: 2023
    },

    // === S24 SERIES (2024) ===
    'S24': {
        display: '6.2" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2400 / Snapdragon 8 Gen 3',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 12MP Front',
        battery: '4000mAh, 25W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Amber Yellow', 'Cobalt Violet', 'Marble Grey', 'Onyx Black'],
        features: ['Galaxy AI', 'Circle to Search', 'Live Translate'],
        series: 'S',
        releaseYear: 2024
    },
    'S24 FE': {
        display: '6.7" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2400e',
        camera: '50MP Wide + 12MP UW + 8MP 3x Tele | 10MP Front',
        battery: '4700mAh, 25W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Blue', 'Graphite', 'Grey', 'Mint', 'Yellow'],
        features: ['Galaxy AI', 'ProVisual Engine', 'IP68'],
        series: 'S',
        releaseYear: 2024
    },
    'S24+': {
        display: '6.7" Dynamic AMOLED 2X (120Hz)',
        processor: 'Exynos 2400 / Snapdragon 8 Gen 3',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 12MP Front',
        battery: '4900mAh, 45W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Amber Yellow', 'Cobalt Violet', 'Marble Grey', 'Onyx Black'],
        features: ['Galaxy AI', '45W Charging', 'QHD+ Display'],
        series: 'S',
        releaseYear: 2024
    },
    'S24 Ultra': {
        display: '6.8" Dynamic AMOLED 2X (120Hz, 2600 nits)',
        processor: 'Snapdragon 8 Gen 3 for Galaxy',
        camera: '200MP Wide + 12MP UW + 50MP 5x Tele + 10MP 3x Tele | 12MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Titanium Black', 'Titanium Grey', 'Titanium Violet', 'Titanium Yellow'],
        features: ['Galaxy AI', 'Titanium Frame', '200MP Camera', 'S Pen'],
        series: 'S',
        releaseYear: 2024
    },

    // === S25 SERIES (2025) ===
    'S25': {
        display: '6.2" Dynamic AMOLED 2X (120Hz)',
        processor: 'Snapdragon 8 Elite for Galaxy',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 12MP Front',
        battery: '4000mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Icy Blue', 'Mint', 'Navy', 'Silver Shadow'],
        features: ['Snapdragon 8 Elite', 'Galaxy AI 2.0', '7 Years Updates'],
        series: 'S',
        releaseYear: 2025
    },
    'S25+': {
        display: '6.7" Dynamic AMOLED 2X (120Hz)',
        processor: 'Snapdragon 8 Elite for Galaxy',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 12MP Front',
        battery: '4900mAh, 45W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Icy Blue', 'Mint', 'Navy', 'Silver Shadow'],
        features: ['Snapdragon 8 Elite', 'Galaxy AI 2.0', 'QHD+ Display'],
        series: 'S',
        releaseYear: 2025
    },
    'S25 Ultra': {
        display: '6.9" Dynamic AMOLED 2X (1-120Hz, 2600 nits)',
        processor: 'Snapdragon 8 Elite for Galaxy',
        camera: '200MP Wide + 50MP 5x Tele + 10MP 3x Tele + 12MP UW | 12MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Titanium Black', 'Titanium Blue', 'Titanium Grey', 'Titanium Silver'],
        features: ['Snapdragon 8 Elite', '200MP Camera', 'S Pen', 'Titanium Frame'],
        series: 'S',
        releaseYear: 2025
    },
    'S25 Edge': {
        display: '6.7" Dynamic AMOLED 2X (120Hz)',
        processor: 'Snapdragon 8 Elite for Galaxy',
        camera: '200MP Wide + 50MP 3x Tele + 12MP UW | 12MP Front',
        battery: '3900mAh, 45W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Titanium Black', 'Titanium Silver'],
        features: ['Ultra Slim 6.4mm', 'Snapdragon 8 Elite', '200MP Camera'],
        series: 'S',
        releaseYear: 2025
    },

    // === Z FLIP SERIES ===
    'Z Flip 3': {
        display: '6.7" Dynamic AMOLED 2X (120Hz) + 1.9" Cover',
        processor: 'Snapdragon 888',
        camera: '12MP Wide + 12MP UW | 10MP Front',
        battery: '3300mAh, 15W Fast Charging',
        os: 'Android 11 (Upgradable to 14)',
        colors: ['Cream', 'Green', 'Lavender', 'Phantom Black'],
        features: ['Foldable', 'IPX8 Water Resistant', 'Flex Mode'],
        series: 'Flip',
        releaseYear: 2021
    },
    'Z Flip 4': {
        display: '6.7" Dynamic AMOLED 2X (120Hz) + 1.9" Cover',
        processor: 'Snapdragon 8+ Gen 1',
        camera: '12MP Wide + 12MP UW | 10MP Front',
        battery: '3700mAh, 25W Fast Charging',
        os: 'Android 12 (Upgradable to 15)',
        colors: ['Bora Purple', 'Graphite', 'Pink Gold', 'Blue'],
        features: ['Foldable', 'IPX8', 'FlexCam'],
        series: 'Flip',
        releaseYear: 2022
    },
    'Z Flip 5': {
        display: '6.7" Dynamic AMOLED 2X (120Hz) + 3.4" Flex Window',
        processor: 'Snapdragon 8 Gen 2 for Galaxy',
        camera: '12MP Wide + 12MP UW | 10MP Front',
        battery: '3700mAh, 25W Fast Charging',
        os: 'Android 13 (Upgradable to 15)',
        colors: ['Mint', 'Graphite', 'Cream', 'Lavender'],
        features: ['Larger Cover Screen', 'Foldable', 'FlexCam'],
        series: 'Flip',
        releaseYear: 2023
    },
    'Z Flip 6': {
        display: '6.7" Dynamic AMOLED 2X (120Hz) + 3.4" Super AMOLED',
        processor: 'Snapdragon 8 Gen 3 for Galaxy',
        camera: '50MP Wide + 12MP UW | 10MP Front',
        battery: '4000mAh, 25W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Silver Shadow', 'Yellow', 'Blue', 'Mint'],
        features: ['Galaxy AI', '50MP Main Camera', 'Vapor Chamber'],
        series: 'Flip',
        releaseYear: 2024
    },
    'Z Flip 7': {
        display: '6.85" Dynamic AMOLED 2X (120Hz) + 4.0" Cover',
        processor: 'Snapdragon 8 Elite',
        camera: '50MP Wide + 12MP UW | 10MP Front',
        battery: '4000mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Silver Shadow', 'Blue', 'Green'],
        features: ['Largest Cover Screen', 'Galaxy AI 2.0', 'Slimmer Design'],
        series: 'Flip',
        releaseYear: 2025
    },
    'Z Flip 7 FE': {
        display: '6.7" Dynamic AMOLED 2X (120Hz) + 3.4" Cover',
        processor: 'Exynos 2500',
        camera: '50MP Wide + 12MP UW | 10MP Front',
        battery: '3700mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Graphite', 'Lavender', 'Mint'],
        features: ['Fan Edition', 'Foldable', 'Galaxy AI'],
        series: 'Flip',
        releaseYear: 2025
    },

    // === Z FOLD SERIES ===
    'Z Fold 3': {
        display: '7.6" Dynamic AMOLED 2X (120Hz) + 6.2" Cover',
        processor: 'Snapdragon 888',
        camera: '12MP Wide + 12MP UW + 12MP Tele | 10MP + 4MP Under Display',
        battery: '4400mAh, 25W Fast Charging',
        os: 'Android 11 (Upgradable to 14)',
        colors: ['Phantom Black', 'Phantom Green', 'Phantom Silver'],
        features: ['Under Display Camera', 'S Pen Support', 'IPX8'],
        series: 'Fold',
        releaseYear: 2021
    },
    'Z Fold 4': {
        display: '7.6" Dynamic AMOLED 2X (120Hz) + 6.2" Cover',
        processor: 'Snapdragon 8+ Gen 1',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 10MP + 4MP UDC',
        battery: '4400mAh, 25W Fast Charging',
        os: 'Android 12 (Upgradable to 15)',
        colors: ['Phantom Black', 'Graygreen', 'Beige'],
        features: ['Taskbar', 'S Pen Fold Edition', 'IPX8'],
        series: 'Fold',
        releaseYear: 2022
    },
    'Z Fold 5': {
        display: '7.6" Dynamic AMOLED 2X (120Hz) + 6.2" Cover',
        processor: 'Snapdragon 8 Gen 2 for Galaxy',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 10MP + 4MP UDC',
        battery: '4400mAh, 25W Fast Charging',
        os: 'Android 13 (Upgradable to 15)',
        colors: ['Icy Blue', 'Phantom Black', 'Cream'],
        features: ['Flex Hinge', 'Slimmer Design', 'S Pen Support'],
        series: 'Fold',
        releaseYear: 2023
    },
    'Z Fold 6': {
        display: '7.6" Dynamic AMOLED 2X (120Hz) + 6.3" Cover',
        processor: 'Snapdragon 8 Gen 3 for Galaxy',
        camera: '50MP Wide + 12MP UW + 10MP 3x Tele | 10MP + 4MP UDC',
        battery: '4400mAh, 25W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Silver Shadow', 'Pink', 'Navy'],
        features: ['Galaxy AI', 'Lighter Frame', 'Enhanced Durability'],
        series: 'Fold',
        releaseYear: 2024
    },
    'Z Fold 7': {
        display: '8.0" Dynamic AMOLED 2X (120Hz) + 6.5" Cover',
        processor: 'Snapdragon 8 Elite for Galaxy',
        camera: '200MP Wide + 12MP UW + 10MP 3x Tele | 10MP Front',
        battery: '4400mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Titanium Black', 'Titanium Silver'],
        features: ['200MP Camera', 'Crease-Free Display', 'Galaxy AI 2.0'],
        series: 'Fold',
        releaseYear: 2025
    },
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from Google Sheet)
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // === S20/S21 OPEN BOX (2020-2021) ===
    { model: 'S20 Plus', ram: '8GB', storage: '128GB', price: 270000, condition: 'Open Box' },
    { model: 'S20 Plus', ram: '8GB', storage: '256GB', price: 300000, condition: 'Open Box' },
    { model: 'S20 ULTRA', ram: '12GB', storage: '128GB', price: 330000, condition: 'Open Box' },
    { model: 'S21 FE', ram: '6GB', storage: '128GB', price: 300000, condition: 'Open Box' },
    { model: 'S21 FE', ram: '8GB', storage: '256GB', price: 320000, condition: 'Open Box' },
    { model: 'S21', ram: '8GB', storage: '128GB', price: 285000, condition: 'Open Box' },
    { model: 'S21', ram: '8GB', storage: '256GB', price: 310000, condition: 'Open Box' },
    { model: 'S21 Plus', ram: '8GB', storage: '128GB', price: 340000, condition: 'Open Box' },
    { model: 'S21 Plus', ram: '8GB', storage: '256GB', price: 370000, condition: 'Open Box' },
    { model: 'S21 Ultra', ram: '12GB', storage: '128GB', price: 390000, condition: 'Open Box' },
    { model: 'S21 Ultra', ram: '12GB', storage: '256GB', price: 440000, condition: 'Open Box' },
    { model: 'S21 Ultra', ram: '16GB', storage: '512GB', price: 510000, condition: 'Open Box' },

    // === S22 OPEN BOX (2022) ===
    { model: 'S22', ram: '8GB', storage: '128GB', price: 370000, condition: 'Open Box' },
    { model: 'S22', ram: '8GB', storage: '256GB', price: 400000, condition: 'Open Box' },
    { model: 'S22 Plus', ram: '8GB', storage: '128GB', price: 410000, condition: 'Open Box' },
    { model: 'S22 Plus', ram: '8GB', storage: '256GB', price: 440000, condition: 'Open Box' },
    { model: 'S22 Plus', ram: '8GB', storage: '512GB', price: 490000, condition: 'Open Box' },
    { model: 'S22 Ultra', ram: '8GB', storage: '128GB', price: 500000, condition: 'Open Box' },
    { model: 'S22 Ultra', ram: '12GB', storage: '256GB', price: 550000, condition: 'Open Box' },
    { model: 'S22 Ultra', ram: '12GB', storage: '512GB', price: 600000, condition: 'Open Box' },

    // === S23 NEW OPEN BOX (2023) ===
    { model: 'S23 FE', ram: '8GB', storage: '128GB', price: 500000, condition: 'New Open Box' },
    { model: 'S23 FE', ram: '8GB', storage: '256GB', price: 550000, condition: 'New Open Box' },
    { model: 'S23', ram: '8GB', storage: '128GB', price: 450000, condition: 'New Open Box' },
    { model: 'S23', ram: '8GB', storage: '256GB', price: 500000, condition: 'New Open Box' },
    { model: 'S23', ram: '8GB', storage: '512GB', price: 600000, condition: 'New Open Box' },
    { model: 'S23+', ram: '8GB', storage: '128GB', price: 600000, condition: 'New Open Box' },
    { model: 'S23+', ram: '8GB', storage: '256GB', price: 550000, condition: 'New Open Box' },
    { model: 'S23+', ram: '8GB', storage: '512GB', price: 680000, condition: 'New Open Box' },
    { model: 'S23 Ultra', ram: '8GB', storage: '256GB', price: 700000, condition: 'New Open Box' },
    { model: 'S23 Ultra', ram: '12GB', storage: '512GB', price: 740000, condition: 'New Open Box' },
    { model: 'S23 Ultra', ram: '12GB', storage: '1TB', price: 820000, condition: 'New Open Box' },

    // === S24 NEW (2024) ===
    { model: 'S24', ram: '8GB', storage: '128GB', price: 630000, condition: 'New' },
    { model: 'S24', ram: '8GB', storage: '256GB', price: 690000, condition: 'New' },
    { model: 'S24', ram: '8GB', storage: '256GB', price: 760000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'S24 FE', ram: '8GB', storage: '128GB', price: 620000, condition: 'New' },
    { model: 'S24 FE', ram: '8GB', storage: '256GB', price: 730000, condition: 'New' },
    { model: 'S24+', ram: '12GB', storage: '256GB', price: 800000, condition: 'New' },
    { model: 'S24+', ram: '12GB', storage: '256GB', price: 850000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'S24+', ram: '12GB', storage: '512GB', price: 900000, condition: 'New' },
    { model: 'S24 Ultra', ram: '12GB', storage: '256GB', price: 980000, condition: 'New' },
    { model: 'S24 Ultra', ram: '12GB', storage: '512GB', price: 1040000, condition: 'New' },
    { model: 'S24 Ultra', ram: '12GB', storage: '512GB', price: 1130000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'S24 Ultra', ram: '12GB', storage: '1TB', price: 1150000, condition: 'New' },

    // === S25 NEW (2025) ===
    { model: 'S25', ram: '12GB', storage: '128GB', price: 860000, condition: 'New' },
    { model: 'S25', ram: '12GB', storage: '256GB', price: 900000, condition: 'New' },
    { model: 'S25+', ram: '12GB', storage: '256GB', price: 980000, condition: 'New' },
    { model: 'S25+', ram: '12GB', storage: '512GB', price: 1450000, condition: 'New', note: 'African warranty' },
    { model: 'S25 Ultra', ram: '12GB', storage: '256GB', price: 1250000, condition: 'New' },
    { model: 'S25 Ultra', ram: '12GB', storage: '512GB', price: 1340000, condition: 'New' },
    { model: 'S25 Ultra', ram: '12GB', storage: '1TB', price: 1580000, condition: 'New' },
    { model: 'S25 Edge', ram: '12GB', storage: '256GB', price: 1300000, condition: 'New' },
    { model: 'S25 Edge', ram: '12GB', storage: '512GB', price: 1400000, condition: 'New' },

    // === Z FLIP NEW ===
    { model: 'Z Flip 3', ram: '8GB', storage: '128GB', price: 300000, condition: 'New' },
    { model: 'Z Flip 3', ram: '8GB', storage: '256GB', price: 320000, condition: 'New' },
    { model: 'Z Flip 4', ram: '8GB', storage: '128GB', price: 330000, condition: 'New' },
    { model: 'Z Flip 4', ram: '8GB', storage: '256GB', price: 350000, condition: 'New' },
    { model: 'Z Flip 4', ram: '8GB', storage: '512GB', price: 385000, condition: 'New' },
    { model: 'Z Flip 5', ram: '8GB', storage: '256GB', price: 500000, condition: 'New' },
    { model: 'Z Flip 5', ram: '8GB', storage: '512GB', price: 550000, condition: 'New' },
    { model: 'Z Flip 6', ram: '8GB', storage: '256GB', price: 680000, condition: 'New' },
    { model: 'Z Flip 6', ram: '8GB', storage: '512GB', price: 750000, condition: 'New' },
    { model: 'Z Flip 7', ram: '12GB', storage: '256GB', price: 1150000, condition: 'New' },
    { model: 'Z Flip 7', ram: '12GB', storage: '512GB', price: 1250000, condition: 'New' },
    { model: 'Z Flip 7 FE', ram: '8GB', storage: '128GB', price: 1200000, condition: 'New' },
    { model: 'Z Flip 7 FE', ram: '8GB', storage: '256GB', price: 1270000, condition: 'New' },

    // === Z FOLD NEW ===
    { model: 'Z Fold 3', ram: '12GB', storage: '256GB', price: 600000, condition: 'New' },
    { model: 'Z Fold 3', ram: '12GB', storage: '512GB', price: 650000, condition: 'New' },
    { model: 'Z Fold 3', ram: '12GB', storage: '256GB', price: 690000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'Z Fold 3', ram: '12GB', storage: '512GB', price: 740000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'Z Fold 4', ram: '12GB', storage: '256GB', price: 700000, condition: 'New' },
    { model: 'Z Fold 4', ram: '12GB', storage: '256GB', price: 850000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'Z Fold 4', ram: '12GB', storage: '512GB', price: 790000, condition: 'New' },
    { model: 'Z Fold 4', ram: '12GB', storage: '512GB', price: 880000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'Z Fold 4', ram: '12GB', storage: '1TB', price: 920000, condition: 'New' },
    { model: 'Z Fold 5', ram: '12GB', storage: '256GB', price: 950000, condition: 'New' },
    { model: 'Z Fold 5', ram: '12GB', storage: '512GB', price: 1000000, condition: 'New' },
    { model: 'Z Fold 5', ram: '12GB', storage: '1TB', price: 1200000, condition: 'New' },
    { model: 'Z Fold 6', ram: '12GB', storage: '256GB', price: 1290000, condition: 'New' },
    { model: 'Z Fold 6', ram: '12GB', storage: '256GB', price: 1400000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'Z Fold 6', ram: '12GB', storage: '512GB', price: 1350000, condition: 'New' },
    { model: 'Z Fold 6', ram: '12GB', storage: '512GB', price: 1500000, condition: 'New', note: 'Dual Physical Sim' },
    { model: 'Z Fold 6', ram: '12GB', storage: '1TB', price: 1400000, condition: 'New' },
    { model: 'Z Fold 7', ram: '12GB', storage: '256GB', price: 2000000, condition: 'New' },
    { model: 'Z Fold 7', ram: '12GB', storage: '512GB', price: 2150000, condition: 'New' },
    { model: 'Z Fold 7', ram: '12GB', storage: '1TB', price: 2790000, condition: 'New' },
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

    let description = `## Samsung Galaxy ${model} Price in Nigeria\n\n`;
    description += `The **${fullName}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;

    if (specs.series === 'Fold') {
        description += `Experience the future of smartphones with this **book-style foldable** featuring a stunning **${specs.display}** and **${specs.processor}** processor.`;
    } else if (specs.series === 'Flip') {
        description += `Compact style meets flagship power with this **clamshell foldable** featuring **${specs.display}** and **${specs.processor}** chip.`;
    } else {
        description += `Powered by **${specs.processor}** with the stunning **${specs.display}** and **${specs.camera.split(' | ')[0]}** camera system.`;
    }

    // Open Box explanation
    if (condition === 'New Open Box' || condition === 'Open Box') {
        description += `\n\n## Condition: New Open Box (Grade A+)\n\n`;
        description += `This device is in **factory-fresh condition** with zero usage:\n`;
        description += `- ✅ **Never Activated:** Phone has never been used or activated\n`;
        description += `- ✅ **Original Packaging:** Box opened only for quality inspection\n`;
        description += `- ✅ **Full Accessories:** Charger, cable, and documentation included\n`;
        description += `- ✅ **Manufacturer Warranty:** Full Samsung warranty applies\n`;
        description += `- ✅ **99%+ Condition:** No scratches, dents, or wear marks\n`;
        description += `- ⚠️ **Why Open Box:** Customer returns (unopened) or display units (unused)\n`;
    }

    description += `\n\n## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | Samsung Galaxy ${model} |
| **Price** | ${priceStr} |
| **Condition** | ${condition} |`;

    if (metadata.ram) description += `\n| **RAM** | ${metadata.ram} |`;
    if (metadata.storage) description += `\n| **Storage** | ${metadata.storage} |`;
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
- ✅ **Guaranteed Quality:** ${condition.includes('Open Box') ? 'Factory-Fresh Open Box with Full Warranty' : 'Brand New (Sealed)'}
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [iPhone 16 Pro Max](/ogabassey/apple) - iOS Alternative
- [Google Pixel 9 Pro](/ogabassey/google) - Pixel Alternative
- [Samsung Galaxy A56](/ogabassey/samsung) - Budget Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedSamsungFlagships() {
    console.log("📱 Starting Samsung S-Series & Foldables Import...\n");

    // Get Samsung category
    const { data: samsungCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'samsung').single();
    if (!samsungCat) {
        console.error("❌ 'Samsung' category not found.");
        return;
    }
    const merchantId = samsungCat.merchant_id;
    const categoryId = samsungCat.id;

    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} Samsung flagship products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = SAMSUNG_FLAGSHIP_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs for ${p.model}, skipping.`);
            continue;
        }

        // Build full name
        let fullName = `Samsung Galaxy ${p.model} ${p.ram} ${p.storage}`;
        if ((p as any).note) fullName += ` (${(p as any).note})`;
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
            brand: 'Samsung',
            model: `Galaxy ${p.model}`,
            ram: p.ram,
            storage: p.storage,
            condition: p.condition,
            releaseYear: specs.releaseYear,
            series: specs.series,
        };

        const description = generateDescription(p.model, fullName, p.price, specs, metadata);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      Price: ₦${p.price.toLocaleString()} | Condition: ${p.condition}`);

        // Determine database condition value
        // For Open Box: we store 'used' in DB (maps to RefurbishedCondition in schema)
        // For New: we store 'new'
        const dbCondition = p.condition.includes('Open Box') ? 'used' : 'new';

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.85), // Estimate 15% margin
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Samsung',
            status: 'active',
            stock: 5,
            condition: dbCondition,
            condition_detail: p.condition  // Store full condition text
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n🏁 Samsung Flagships Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedSamsungFlagships().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
