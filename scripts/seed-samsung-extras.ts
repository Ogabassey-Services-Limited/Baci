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
// SAMSUNG AUDIO SPECS
// ------------------------------------------------------------------
const AUDIO_SPECS: Record<string, any> = {
    'Galaxy Buds': {
        driver: '6mm Dynamic',
        battery: '6 hours (+ 7 hours case)',
        features: ['Bluetooth 5.0', 'IPX2', 'Touch Controls', 'Ambient Sound'],
        releaseYear: 2019
    },
    'Galaxy Buds+': {
        driver: '2-way (Woofer + Tweeter)',
        battery: '11 hours (+ 11 hours case)',
        features: ['Bluetooth 5.0', 'IPX2', '3 Mics', 'Ambient Sound'],
        releaseYear: 2020
    },
    'Galaxy Buds Live': {
        driver: '12mm AKG',
        battery: '6 hours (+ 15 hours case)',
        features: ['ANC', 'Open-Type', 'Bass Boost', 'Bluetooth 5.0'],
        releaseYear: 2020
    },
    'Galaxy Buds Pro': {
        driver: '2-way (11mm + 6.5mm)',
        battery: '5 hours ANC (+ 13 hours case)',
        features: ['Intelligent ANC', 'IPX7', '360 Audio', 'Voice Detect'],
        releaseYear: 2021
    },
    'Galaxy Buds2': {
        driver: '2-way (11mm + 6.5mm)',
        battery: '5 hours ANC (+ 15 hours case)',
        features: ['Active Noise Cancellation', 'IPX2', 'Ambient Sound', '3 Mics'],
        releaseYear: 2021
    },
    'Galaxy Buds2 Pro': {
        driver: '2-way (10mm + 5.3mm)',
        battery: '5 hours ANC (+ 13 hours case)',
        features: ['Intelligent ANC', 'IPX7', '360 Audio', '24-bit Hi-Fi', 'Seamless Codec'],
        releaseYear: 2022
    },
    'Galaxy Buds FE': {
        driver: '2-way (10mm + 5.3mm)',
        battery: '6 hours ANC (+ 15 hours case)',
        features: ['Active Noise Cancellation', 'IPX2', '360 Audio', 'Ambient Sound'],
        releaseYear: 2023
    },
    'Galaxy Buds3': {
        driver: '10.5mm Planar',
        battery: '6 hours ANC (+ 24 hours case)',
        features: ['AI-powered ANC', 'IP57', 'Blade Lights', '360 Audio'],
        releaseYear: 2024
    },
    'Galaxy Buds3 Pro': {
        driver: '10.5mm Planar + 6.1mm Tweeter',
        battery: '7 hours ANC (+ 26 hours case)',
        features: ['AI-powered ANC', 'IP57', 'Blade Lights', 'SSC Codec', '2-way Speaker'],
        releaseYear: 2024
    },
};

// ------------------------------------------------------------------
// SAMSUNG TABLET SPECS
// ------------------------------------------------------------------
const TABLET_SPECS: Record<string, any> = {
    'Galaxy Tab A7': {
        display: '10.4" TFT LCD (2000x1200)',
        processor: 'Snapdragon 662',
        battery: '7040mAh',
        features: ['Quad Speakers', 'Metal Design', '8MP Camera'],
        releaseYear: 2020
    },
    'Galaxy Tab A7 Lite': {
        display: '8.7" TFT LCD (1340x800)',
        processor: 'MediaTek Helio P22T',
        battery: '5100mAh',
        features: ['Compact Design', 'Dolby Atmos', '8MP Camera'],
        releaseYear: 2021
    },
    'Galaxy Tab A8': {
        display: '10.5" TFT LCD (1920x1200)',
        processor: 'UniSOC T618',
        battery: '7040mAh',
        features: ['Quad Speakers', 'Metal Frame', 'Face Unlock'],
        releaseYear: 2021
    },
    'Galaxy Tab A9': {
        display: '8.7" TFT LCD (1340x800)',
        processor: 'MediaTek Helio G99',
        battery: '5100mAh',
        features: ['Dolby Atmos', 'Face Unlock', '8MP Camera'],
        releaseYear: 2023
    },
    'Galaxy Tab A9+': {
        display: '11" TFT LCD (1920x1200)',
        processor: 'Snapdragon 695',
        battery: '7040mAh',
        features: ['Quad Speakers', '90Hz Display', 'Face Unlock'],
        releaseYear: 2023
    },
    'Galaxy Tab S6 Lite': {
        display: '10.4" TFT LCD (2000x1200)',
        processor: 'Snapdragon 720G',
        battery: '7040mAh',
        features: ['S Pen Included', 'AKG Speakers', 'Metal Body'],
        releaseYear: 2020
    },
    'Galaxy Tab S7': {
        display: '11" LTPS LCD (2560x1600) 120Hz',
        processor: 'Snapdragon 865+',
        battery: '8000mAh',
        features: ['S Pen', '120Hz Display', 'Quad Speakers', 'DeX Mode'],
        releaseYear: 2020
    },
    'Galaxy Tab S7+': {
        display: '12.4" Super AMOLED (2800x1752) 120Hz',
        processor: 'Snapdragon 865+',
        battery: '10090mAh',
        features: ['S Pen', '120Hz AMOLED', 'In-display Fingerprint', 'DeX'],
        releaseYear: 2020
    },
    'Galaxy Tab S7 FE': {
        display: '12.4" TFT LCD (2560x1600)',
        processor: 'Snapdragon 778G',
        battery: '10090mAh',
        features: ['S Pen Included', 'AKG Speakers', 'DeX Mode'],
        releaseYear: 2021
    },
    'Galaxy Tab S8': {
        display: '11" LTPS LCD (2560x1600) 120Hz',
        processor: 'Snapdragon 8 Gen 1',
        battery: '8000mAh',
        features: ['S Pen', '120Hz', 'Vapor Chamber Cooling', 'DeX'],
        releaseYear: 2022
    },
    'Galaxy Tab S8+': {
        display: '12.4" Super AMOLED (2800x1752) 120Hz',
        processor: 'Snapdragon 8 Gen 1',
        battery: '10090mAh',
        features: ['S Pen', '120Hz AMOLED', 'In-display Fingerprint', '5G'],
        releaseYear: 2022
    },
    'Galaxy Tab S8 Ultra': {
        display: '14.6" Super AMOLED (2960x1848) 120Hz',
        processor: 'Snapdragon 8 Gen 1',
        battery: '11200mAh',
        features: ['S Pen', 'Notch Camera', '120Hz AMOLED', 'Armor Aluminum'],
        releaseYear: 2022
    },
    'Galaxy Tab S9': {
        display: '11" Dynamic AMOLED 2X (2560x1600) 120Hz',
        processor: 'Snapdragon 8 Gen 2',
        battery: '8400mAh',
        features: ['S Pen', 'IP68', 'Vision Booster', 'Vapor Chamber'],
        releaseYear: 2023
    },
    'Galaxy Tab S9+': {
        display: '12.4" Dynamic AMOLED 2X (2800x1752) 120Hz',
        processor: 'Snapdragon 8 Gen 2',
        battery: '10090mAh',
        features: ['S Pen', 'IP68', 'Vision Booster', 'In-display Fingerprint'],
        releaseYear: 2023
    },
    'Galaxy Tab S9 Ultra': {
        display: '14.6" Dynamic AMOLED 2X (2960x1848) 120Hz',
        processor: 'Snapdragon 8 Gen 2',
        battery: '11200mAh',
        features: ['S Pen', 'IP68', 'Dual 12MP Front', 'Armor Aluminum'],
        releaseYear: 2023
    },
    'Galaxy Tab S9 FE': {
        display: '10.9" TFT LCD (2304x1440) 90Hz',
        processor: 'Exynos 1380',
        battery: '8000mAh',
        features: ['S Pen Included', 'IP68', 'AKG Speakers'],
        releaseYear: 2023
    },
    'Galaxy Tab S9 FE+': {
        display: '12.4" TFT LCD (2560x1600) 90Hz',
        processor: 'Exynos 1380',
        battery: '10090mAh',
        features: ['S Pen Included', 'IP68', 'AKG Speakers', 'DeX'],
        releaseYear: 2023
    },
    'Galaxy Tab S10+': {
        display: '12.4" Dynamic AMOLED 2X 120Hz',
        processor: 'MediaTek Dimensity 9300+',
        battery: '10090mAh',
        features: ['S Pen', 'IP68', 'Galaxy AI', 'Vision Booster'],
        releaseYear: 2024
    },
    'Galaxy Tab S10 Ultra': {
        display: '14.6" Dynamic AMOLED 2X 120Hz',
        processor: 'MediaTek Dimensity 9300+',
        battery: '11200mAh',
        features: ['S Pen', 'IP68', 'Galaxy AI', 'Armor Aluminum'],
        releaseYear: 2024
    },
};

// ------------------------------------------------------------------
// SAMSUNG WATCH SPECS
// ------------------------------------------------------------------
const WATCH_SPECS: Record<string, any> = {
    'Galaxy Watch4': {
        display: '40mm/44mm Super AMOLED',
        processor: 'Exynos W920',
        battery: '247mAh/361mAh',
        features: ['BioActive Sensor', 'Body Composition', 'Wear OS', '5ATM'],
        releaseYear: 2021
    },
    'Galaxy Watch4 Classic': {
        display: '42mm/46mm Super AMOLED',
        processor: 'Exynos W920',
        battery: '247mAh/361mAh',
        features: ['Rotating Bezel', 'BioActive Sensor', 'ECG', 'Stainless Steel'],
        releaseYear: 2021
    },
    'Galaxy Watch5': {
        display: '40mm/44mm Super AMOLED',
        processor: 'Exynos W920',
        battery: '284mAh/410mAh',
        features: ['Sapphire Crystal', 'BioActive Sensor', 'Temperature Sensor', '5ATM'],
        releaseYear: 2022
    },
    'Galaxy Watch5 Pro': {
        display: '45mm Super AMOLED',
        processor: 'Exynos W920',
        battery: '590mAh',
        features: ['Titanium', 'Sapphire Crystal', 'Route Workout', 'GPX Import'],
        releaseYear: 2022
    },
    'Galaxy Watch6': {
        display: '40mm/44mm Super AMOLED',
        processor: 'Exynos W930',
        battery: '300mAh/425mAh',
        features: ['Larger Display', 'Improved BioActive', 'Quick Button', 'One UI 5 Watch'],
        releaseYear: 2023
    },
    'Galaxy Watch6 Classic': {
        display: '43mm/47mm Super AMOLED',
        processor: 'Exynos W930',
        battery: '300mAh/425mAh',
        features: ['Rotating Bezel', 'Sapphire Crystal', 'ECG', 'Stainless Steel'],
        releaseYear: 2023
    },
    'Galaxy Watch FE': {
        display: '40mm Super AMOLED',
        processor: 'Exynos W920',
        battery: '247mAh',
        features: ['BioActive Sensor', 'Sleep Coaching', 'Wear OS', 'Sapphire Crystal'],
        releaseYear: 2024
    },
    'Galaxy Watch7': {
        display: '40mm/44mm Super AMOLED',
        processor: 'Exynos W1000 (3nm)',
        battery: '300mAh/425mAh',
        features: ['3nm Processor', 'Dual-Band GPS', 'AGEs Index', 'Energy Score'],
        releaseYear: 2024
    },
    'Galaxy Watch Ultra': {
        display: '47mm Super AMOLED (3000 nits)',
        processor: 'Exynos W1000 (3nm)',
        battery: '590mAh',
        features: ['Titanium Grade 4', '10ATM + IP68', 'Quick Button', 'Night Vision'],
        releaseYear: 2024
    },
};

// ------------------------------------------------------------------
// PRODUCTS TO SEED
// ------------------------------------------------------------------

// AUDIO PRODUCTS
const AUDIO_PRODUCTS = [
    // === Galaxy Buds (New) ===
    { name: 'Samsung Galaxy Buds FE', specs: 'Galaxy Buds FE', price: 85000, condition: 'New' },
    { name: 'Samsung Galaxy Buds2', specs: 'Galaxy Buds2', price: 95000, condition: 'New' },
    { name: 'Samsung Galaxy Buds2 Pro', specs: 'Galaxy Buds2 Pro', price: 145000, condition: 'New' },
    { name: 'Samsung Galaxy Buds3', specs: 'Galaxy Buds3', price: 165000, condition: 'New' },
    { name: 'Samsung Galaxy Buds3 Pro', specs: 'Galaxy Buds3 Pro', price: 225000, condition: 'New' },

    // === Galaxy Buds (Premium Used) ===
    { name: 'Samsung Galaxy Buds', specs: 'Galaxy Buds', price: 35000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Buds+', specs: 'Galaxy Buds+', price: 40000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Buds Live', specs: 'Galaxy Buds Live', price: 45000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Buds Pro', specs: 'Galaxy Buds Pro', price: 55000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Buds2', specs: 'Galaxy Buds2', price: 60000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Buds2 Pro', specs: 'Galaxy Buds2 Pro', price: 85000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Buds FE', specs: 'Galaxy Buds FE', price: 55000, condition: 'Premium Used' },
];

// TABLET PRODUCTS
const TABLET_PRODUCTS = [
    // === Tab A Series (New) ===
    { name: 'Samsung Galaxy Tab A8 WiFi 32GB', specs: 'Galaxy Tab A8', storage: '32GB', connectivity: 'WiFi', price: 135000, condition: 'New' },
    { name: 'Samsung Galaxy Tab A8 WiFi 64GB', specs: 'Galaxy Tab A8', storage: '64GB', connectivity: 'WiFi', price: 155000, condition: 'New' },
    { name: 'Samsung Galaxy Tab A8 LTE 64GB', specs: 'Galaxy Tab A8', storage: '64GB', connectivity: 'LTE', price: 175000, condition: 'New' },
    { name: 'Samsung Galaxy Tab A9 WiFi 64GB', specs: 'Galaxy Tab A9', storage: '64GB', connectivity: 'WiFi', price: 115000, condition: 'New' },
    { name: 'Samsung Galaxy Tab A9+ WiFi 64GB', specs: 'Galaxy Tab A9+', storage: '64GB', connectivity: 'WiFi', price: 185000, condition: 'New' },
    { name: 'Samsung Galaxy Tab A9+ LTE 64GB', specs: 'Galaxy Tab A9+', storage: '64GB', connectivity: 'LTE', price: 210000, condition: 'New' },

    // === Tab S Series (New) ===
    { name: 'Samsung Galaxy Tab S6 Lite WiFi 64GB', specs: 'Galaxy Tab S6 Lite', storage: '64GB', connectivity: 'WiFi', price: 250000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S9 FE WiFi 128GB', specs: 'Galaxy Tab S9 FE', storage: '128GB', connectivity: 'WiFi', price: 380000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S9 FE+ WiFi 128GB', specs: 'Galaxy Tab S9 FE+', storage: '128GB', connectivity: 'WiFi', price: 480000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S9 WiFi 128GB', specs: 'Galaxy Tab S9', storage: '128GB', connectivity: 'WiFi', price: 650000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S9 5G 256GB', specs: 'Galaxy Tab S9', storage: '256GB', connectivity: '5G', price: 780000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S9+ WiFi 256GB', specs: 'Galaxy Tab S9+', storage: '256GB', connectivity: 'WiFi', price: 850000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S9 Ultra WiFi 256GB', specs: 'Galaxy Tab S9 Ultra', storage: '256GB', connectivity: 'WiFi', price: 1100000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S10+ WiFi 256GB', specs: 'Galaxy Tab S10+', storage: '256GB', connectivity: 'WiFi', price: 950000, condition: 'New' },
    { name: 'Samsung Galaxy Tab S10 Ultra WiFi 256GB', specs: 'Galaxy Tab S10 Ultra', storage: '256GB', connectivity: 'WiFi', price: 1250000, condition: 'New' },

    // === Tab A Series (Premium Used) ===
    { name: 'Samsung Galaxy Tab A7 WiFi 32GB', specs: 'Galaxy Tab A7', storage: '32GB', connectivity: 'WiFi', price: 75000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab A7 Lite WiFi 32GB', specs: 'Galaxy Tab A7 Lite', storage: '32GB', connectivity: 'WiFi', price: 55000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab A8 WiFi 32GB', specs: 'Galaxy Tab A8', storage: '32GB', connectivity: 'WiFi', price: 85000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab A8 WiFi 64GB', specs: 'Galaxy Tab A8', storage: '64GB', connectivity: 'WiFi', price: 95000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab A9+ WiFi 64GB', specs: 'Galaxy Tab A9+', storage: '64GB', connectivity: 'WiFi', price: 120000, condition: 'Premium Used' },

    // === Tab S Series (Premium Used) ===
    { name: 'Samsung Galaxy Tab S6 Lite WiFi 64GB', specs: 'Galaxy Tab S6 Lite', storage: '64GB', connectivity: 'WiFi', price: 145000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S7 WiFi 128GB', specs: 'Galaxy Tab S7', storage: '128GB', connectivity: 'WiFi', price: 280000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S7+ WiFi 128GB', specs: 'Galaxy Tab S7+', storage: '128GB', connectivity: 'WiFi', price: 350000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S7 FE WiFi 64GB', specs: 'Galaxy Tab S7 FE', storage: '64GB', connectivity: 'WiFi', price: 230000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S8 WiFi 128GB', specs: 'Galaxy Tab S8', storage: '128GB', connectivity: 'WiFi', price: 380000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S8+ WiFi 128GB', specs: 'Galaxy Tab S8+', storage: '128GB', connectivity: 'WiFi', price: 450000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S8 Ultra WiFi 128GB', specs: 'Galaxy Tab S8 Ultra', storage: '128GB', connectivity: 'WiFi', price: 580000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S9 WiFi 128GB', specs: 'Galaxy Tab S9', storage: '128GB', connectivity: 'WiFi', price: 450000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S9+ WiFi 256GB', specs: 'Galaxy Tab S9+', storage: '256GB', connectivity: 'WiFi', price: 580000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Tab S9 Ultra WiFi 256GB', specs: 'Galaxy Tab S9 Ultra', storage: '256GB', connectivity: 'WiFi', price: 750000, condition: 'Premium Used' },
];

// WATCH PRODUCTS
const WATCH_PRODUCTS = [
    // === Galaxy Watch (New) ===
    { name: 'Samsung Galaxy Watch FE 40mm Bluetooth', specs: 'Galaxy Watch FE', size: '40mm', connectivity: 'Bluetooth', price: 145000, condition: 'New' },
    { name: 'Samsung Galaxy Watch6 40mm Bluetooth', specs: 'Galaxy Watch6', size: '40mm', connectivity: 'Bluetooth', price: 220000, condition: 'New' },
    { name: 'Samsung Galaxy Watch6 44mm Bluetooth', specs: 'Galaxy Watch6', size: '44mm', connectivity: 'Bluetooth', price: 250000, condition: 'New' },
    { name: 'Samsung Galaxy Watch6 40mm LTE', specs: 'Galaxy Watch6', size: '40mm', connectivity: 'LTE', price: 280000, condition: 'New' },
    { name: 'Samsung Galaxy Watch6 Classic 43mm Bluetooth', specs: 'Galaxy Watch6 Classic', size: '43mm', connectivity: 'Bluetooth', price: 300000, condition: 'New' },
    { name: 'Samsung Galaxy Watch6 Classic 47mm Bluetooth', specs: 'Galaxy Watch6 Classic', size: '47mm', connectivity: 'Bluetooth', price: 330000, condition: 'New' },
    { name: 'Samsung Galaxy Watch7 40mm Bluetooth', specs: 'Galaxy Watch7', size: '40mm', connectivity: 'Bluetooth', price: 280000, condition: 'New' },
    { name: 'Samsung Galaxy Watch7 44mm Bluetooth', specs: 'Galaxy Watch7', size: '44mm', connectivity: 'Bluetooth', price: 310000, condition: 'New' },
    { name: 'Samsung Galaxy Watch Ultra 47mm LTE', specs: 'Galaxy Watch Ultra', size: '47mm', connectivity: 'LTE', price: 550000, condition: 'New' },

    // === Galaxy Watch (Premium Used) ===
    { name: 'Samsung Galaxy Watch4 40mm Bluetooth', specs: 'Galaxy Watch4', size: '40mm', connectivity: 'Bluetooth', price: 85000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch4 44mm Bluetooth', specs: 'Galaxy Watch4', size: '44mm', connectivity: 'Bluetooth', price: 95000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch4 40mm LTE', specs: 'Galaxy Watch4', size: '40mm', connectivity: 'LTE', price: 105000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch4 44mm LTE', specs: 'Galaxy Watch4', size: '44mm', connectivity: 'LTE', price: 115000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch4 Classic 42mm Bluetooth', specs: 'Galaxy Watch4 Classic', size: '42mm', connectivity: 'Bluetooth', price: 110000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch4 Classic 46mm Bluetooth', specs: 'Galaxy Watch4 Classic', size: '46mm', connectivity: 'Bluetooth', price: 125000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch4 Classic 42mm LTE', specs: 'Galaxy Watch4 Classic', size: '42mm', connectivity: 'LTE', price: 130000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch4 Classic 46mm LTE', specs: 'Galaxy Watch4 Classic', size: '46mm', connectivity: 'LTE', price: 145000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch5 40mm Bluetooth', specs: 'Galaxy Watch5', size: '40mm', connectivity: 'Bluetooth', price: 120000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch5 44mm Bluetooth', specs: 'Galaxy Watch5', size: '44mm', connectivity: 'Bluetooth', price: 135000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch5 40mm LTE', specs: 'Galaxy Watch5', size: '40mm', connectivity: 'LTE', price: 145000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch5 44mm LTE', specs: 'Galaxy Watch5', size: '44mm', connectivity: 'LTE', price: 160000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch5 Pro 45mm Bluetooth', specs: 'Galaxy Watch5 Pro', size: '45mm', connectivity: 'Bluetooth', price: 180000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch5 Pro 45mm LTE', specs: 'Galaxy Watch5 Pro', size: '45mm', connectivity: 'LTE', price: 210000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch6 40mm Bluetooth', specs: 'Galaxy Watch6', size: '40mm', connectivity: 'Bluetooth', price: 150000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch6 44mm Bluetooth', specs: 'Galaxy Watch6', size: '44mm', connectivity: 'Bluetooth', price: 170000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch6 Classic 43mm Bluetooth', specs: 'Galaxy Watch6 Classic', size: '43mm', connectivity: 'Bluetooth', price: 200000, condition: 'Premium Used' },
    { name: 'Samsung Galaxy Watch6 Classic 47mm Bluetooth', specs: 'Galaxy Watch6 Classic', size: '47mm', connectivity: 'Bluetooth', price: 220000, condition: 'Premium Used' },
];

// ------------------------------------------------------------------
// DESCRIPTION GENERATORS
// ------------------------------------------------------------------
function generateAudioDescription(product: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.price);
    const monthlyPayment = Math.ceil(product.price / 10);
    const isUsed = product.condition === 'Premium Used';

    let desc = `## ${product.name} Price in Nigeria

The **${product.name}** is available at Ogabassey for **${priceStr}**, or pay **₦${monthlyPayment.toLocaleString()}/month × 10** via BNPL. Features: ${specs.features.join(', ')}.

`;

    if (isUsed) {
        desc += `## Condition: Premium Used (Grade A)

- ✅ **Tested & Certified:** Full audio diagnostics passed
- ✅ **90%+ Condition:** Minor cosmetic wear only
- ✅ **Battery Health:** Verified working

`;
    }

    desc += `## Specifications

| Spec | Value |
|------|-------|
| **Driver** | ${specs.driver} |
| **Battery** | ${specs.battery} |
| **Features** | ${specs.features.join(', ')} |

## Why Buy from Ogabassey?

- ✅ **BNPL:** ₦${monthlyPayment.toLocaleString()}/month × 10
- ✅ **Warranty:** ${isUsed ? '90-day' : '1-year Samsung'} warranty
- ✅ **Delivery:** Same-day Lagos, 2-5 days nationwide`;

    return desc.trim();
}

function generateTabletDescription(product: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.price);
    const monthlyPayment = Math.ceil(product.price / 10);
    const isUsed = product.condition === 'Premium Used';

    let desc = `## ${product.name} Price in Nigeria

The **${product.name}** is available at Ogabassey for **${priceStr}**, or pay **₦${monthlyPayment.toLocaleString()}/month × 10** via BNPL. Powered by **${specs.processor}** with **${specs.display}**.

`;

    if (isUsed) {
        desc += `## Condition: Premium Used (Grade A)

- ✅ **Tested & Certified:** Full diagnostics passed
- ✅ **90%+ Condition:** Minor cosmetic wear only
- ✅ **Battery Health:** 80%+ verified

`;
    }

    desc += `## Specifications

| Spec | Value |
|------|-------|
| **Storage** | ${product.storage} |
| **Connectivity** | ${product.connectivity} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **Battery** | ${specs.battery} |
| **Features** | ${specs.features.join(', ')} |

## Why Buy from Ogabassey?

- ✅ **BNPL:** ₦${monthlyPayment.toLocaleString()}/month × 10
- ✅ **Warranty:** ${isUsed ? '90-day' : '1-year Samsung'} warranty
- ✅ **Delivery:** Same-day Lagos, 2-5 days nationwide`;

    return desc.trim();
}

function generateWatchDescription(product: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.price);
    const monthlyPayment = Math.ceil(product.price / 10);
    const isUsed = product.condition === 'Premium Used';

    let desc = `## ${product.name} Price in Nigeria

The **${product.name}** is available at Ogabassey for **${priceStr}**, or pay **₦${monthlyPayment.toLocaleString()}/month × 10** via BNPL. Features: ${specs.features.join(', ')}.

`;

    if (isUsed) {
        desc += `## Condition: Premium Used (Grade A)

- ✅ **Tested & Certified:** Full diagnostics passed
- ✅ **90%+ Condition:** Minor cosmetic wear only
- ✅ **Battery Health:** 80%+ verified

`;
    }

    desc += `## Specifications

| Spec | Value |
|------|-------|
| **Size** | ${product.size} |
| **Connectivity** | ${product.connectivity} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **Battery** | ${specs.battery} |
| **Features** | ${specs.features.join(', ')} |

## Why Buy from Ogabassey?

- ✅ **BNPL:** ₦${monthlyPayment.toLocaleString()}/month × 10
- ✅ **Warranty:** ${isUsed ? '90-day' : '1-year Samsung'} warranty
- ✅ **Delivery:** Same-day Lagos, 2-5 days nationwide`;

    return desc.trim();
}

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedSamsungExtras() {
    console.log("🌱 Seeding Samsung Audio, Tablets & Wearables...\n");

    // Get categories
    const { data: audioCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'audio').single();
    const { data: tabletCat } = await supabase.from('categories').select('id').eq('slug', 'tablets').single();
    const { data: wearablesCat } = await supabase.from('categories').select('id').eq('slug', 'wearables').single();

    if (!audioCat || !tabletCat || !wearablesCat) {
        console.error("❌ Missing required categories (audio, tablets, wearables)");
        return;
    }

    const merchantId = audioCat.merchant_id;
    let totalCreated = 0;
    let totalSkipped = 0;

    // === Part 1: Audio Products ===
    console.log("📊 Part 1: Adding", AUDIO_PRODUCTS.length, "Samsung Audio Products...\n");

    for (const p of AUDIO_PRODUCTS) {
        const specs = AUDIO_SPECS[p.specs];
        if (!specs) continue;

        const fullName = `${p.name} (${p.condition})`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log("   ⏩ Skipping existing:", fullName);
            totalSkipped++;
            continue;
        }

        const description = generateAudioDescription(p, specs);
        const isUsed = p.condition === 'Premium Used';

        console.log("   ✨ Creating:", fullName, "— ₦" + p.price.toLocaleString());

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.85),
            description: description,
            metadata: { brand: 'Samsung', condition: p.condition, releaseYear: specs.releaseYear },
            category: 'Audio',
            status: 'active',
            stock: 5,
            condition: isUsed ? 'used' : 'new',
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: audioCat.id });
            totalCreated++;
        }
    }

    // === Part 2: Tablet Products ===
    console.log("\n📊 Part 2: Adding", TABLET_PRODUCTS.length, "Samsung Tablet Products...\n");

    for (const p of TABLET_PRODUCTS) {
        const specs = TABLET_SPECS[p.specs];
        if (!specs) continue;

        const fullName = `${p.name} (${p.condition})`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log("   ⏩ Skipping existing:", fullName);
            totalSkipped++;
            continue;
        }

        const description = generateTabletDescription(p, specs);
        const isUsed = p.condition === 'Premium Used';

        console.log("   ✨ Creating:", fullName, "— ₦" + p.price.toLocaleString());

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.85),
            description: description,
            metadata: { brand: 'Samsung', storage: p.storage, connectivity: p.connectivity, condition: p.condition, releaseYear: specs.releaseYear },
            category: 'Tablets',
            status: 'active',
            stock: 3,
            condition: isUsed ? 'used' : 'new',
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: tabletCat.id });
            totalCreated++;
        }
    }

    // === Part 3: Watch Products ===
    console.log("\n📊 Part 3: Adding", WATCH_PRODUCTS.length, "Samsung Watch Products...\n");

    for (const p of WATCH_PRODUCTS) {
        const specs = WATCH_SPECS[p.specs];
        if (!specs) continue;

        const fullName = `${p.name} (${p.condition})`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log("   ⏩ Skipping existing:", fullName);
            totalSkipped++;
            continue;
        }

        const description = generateWatchDescription(p, specs);
        const isUsed = p.condition === 'Premium Used';

        console.log("   ✨ Creating:", fullName, "— ₦" + p.price.toLocaleString());

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.85),
            description: description,
            metadata: { brand: 'Samsung', size: p.size, connectivity: p.connectivity, condition: p.condition, releaseYear: specs.releaseYear },
            category: 'Wearables',
            status: 'active',
            stock: 4,
            condition: isUsed ? 'used' : 'new',
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: wearablesCat.id });
            totalCreated++;
        }
    }

    console.log(`\n🏁 Seeding Complete!`);
    console.log("   ✅ Created:", totalCreated);
    console.log("   ⏩ Skipped:", totalSkipped);
    console.log("\n   📊 Breakdown:");
    console.log("   - Audio:", AUDIO_PRODUCTS.length, "products");
    console.log("   - Tablets:", TABLET_PRODUCTS.length, "products");
    console.log("   - Watches:", WATCH_PRODUCTS.length, "products");
}

seedSamsungExtras();
