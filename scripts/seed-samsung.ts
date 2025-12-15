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
// 1. SAMSUNG_SPECS: Full EAV Data (Researched 2024/2025)
// ------------------------------------------------------------------
const SAMSUNG_SPECS: Record<string, {
    display: string;
    processor: string;
    camera: string;
    battery: string;
    os: string;
    colors: string[];
    features: string[];
    type: 'phone' | 'tablet' | 'wearable' | 'accessory';
}> = {
    // === A-SERIES PHONES (2025) ===
    'A56 5G': {
        display: '6.7" FHD+ Super AMOLED (120Hz, 1900 nits)',
        processor: 'Samsung Exynos 1580 (4nm)',
        camera: '50MP (OIS) + 12MP UW + 5MP Macro | 12MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 15 (One UI 7.0)',
        colors: ['Awesome Navy', 'Awesome Lilac', 'Awesome Iceblue'],
        features: ['IP67 Water Resistant', 'Gorilla Glass Victus+', '6 Years Updates', 'Galaxy AI'],
        type: 'phone'
    },
    'A36 5G': {
        display: '6.7" FHD+ Super AMOLED (120Hz, 1200 nits)',
        processor: 'Qualcomm Snapdragon 6 Gen 3 (4nm)',
        camera: '50MP (OIS) + 8MP UW + 5MP Macro | 12MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 15 (One UI 7.0)',
        colors: ['Awesome Navy', 'Awesome Lilac', 'Awesome Iceblue'],
        features: ['IP67 Water Resistant', 'Gorilla Glass Victus+', '6 Years Updates'],
        type: 'phone'
    },
    'A26 5G': {
        display: '6.7" FHD+ Super AMOLED (120Hz)',
        processor: 'Samsung Exynos 1380 (5nm)',
        camera: '50MP (OIS) + 8MP UW + 2MP Macro | 13MP Front',
        battery: '5000mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7.0)',
        colors: ['Awesome Navy', 'Awesome Lilac', 'Awesome Iceblue'],
        features: ['IP67 Water Resistant', 'Gorilla Glass Victus+', '6 Years Updates'],
        type: 'phone'
    },
    'A17 5G': {
        display: '6.7" FHD+ Super AMOLED (90Hz)',
        processor: 'Samsung Exynos 1330 (5nm)',
        camera: '50MP (OIS) + 5MP UW + 2MP Macro | 13MP Front',
        battery: '5000mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7.0)',
        colors: ['Gold', 'Blue Black', 'Light Blue'],
        features: ['IP54 Splash Resistant', 'Gorilla Glass Victus', '6 Years Updates'],
        type: 'phone'
    },
    'A17 LTE': {
        display: '6.7" FHD+ Super AMOLED (90Hz)',
        processor: 'MediaTek Helio G99 (6nm)',
        camera: '50MP (OIS) + 5MP UW + 2MP Macro | 13MP Front',
        battery: '5000mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7.0)',
        colors: ['Gold', 'Blue Black', 'Light Blue'],
        features: ['IP54 Splash Resistant', 'Gorilla Glass Victus', '6 Years Updates'],
        type: 'phone'
    },
    'A16 LTE': {
        display: '6.7" FHD+ Super AMOLED (90Hz)',
        processor: 'MediaTek Helio G99 (6nm)',
        camera: '50MP + 5MP UW + 2MP Macro | 13MP Front',
        battery: '5000mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 7.0)',
        colors: ['Blue Black', 'Light Blue', 'Gold'],
        features: ['IP54 Splash Resistant', '6 Years Updates'],
        type: 'phone'
    },
    'A07': {
        display: '6.7" HD+ PLS LCD (90Hz)',
        processor: 'MediaTek Helio G99 (6nm)',
        camera: '50MP + 2MP Depth | 8MP Front',
        battery: '5000mAh, 25W Fast Charging',
        os: 'Android 15 (One UI 8)',
        colors: ['Black', 'Light Blue', 'Gold'],
        features: ['Side Fingerprint', '6 Years Updates'],
        type: 'phone'
    },
    'A06 5G': {
        display: '6.7" HD+ PLS LCD (90Hz)',
        processor: 'MediaTek Dimensity 6100+ (6nm)',
        camera: '50MP + 2MP Depth | 8MP Front',
        battery: '5000mAh, 25W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Black', 'Light Blue', 'Gold'],
        features: ['Side Fingerprint', '5G Support'],
        type: 'phone'
    },
    'A06 LTE': {
        display: '6.7" HD+ PLS LCD (60Hz)',
        processor: 'MediaTek Helio G85 (12nm)',
        camera: '50MP + 2MP Depth | 8MP Front',
        battery: '5000mAh, 15W Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Black', 'Light Blue', 'Gold'],
        features: ['Side Fingerprint', 'Dual SIM'],
        type: 'phone'
    },

    // === TABLETS ===
    'Tab S11 Ultra 5G': {
        display: '14.6" Dynamic AMOLED 2X (120Hz, QHD+)',
        processor: 'MediaTek Dimensity 9400+ (3nm)',
        camera: '13MP + 8MP UW | Dual 12MP Front',
        battery: '11,600mAh, 45W Fast Charging',
        os: 'Android 16 (One UI 8)',
        colors: ['Gray', 'Silver'],
        features: ['S Pen Included', 'IP68 Water Resistant', 'DeX Mode', 'Galaxy AI'],
        type: 'tablet'
    },
    'Tab S11 5G': {
        display: '11" LTPS TFT (120Hz)',
        processor: 'MediaTek Dimensity 9300+ (3nm)',
        camera: '13MP | 12MP Front',
        battery: '8400mAh, 45W Fast Charging',
        os: 'Android 15 (One UI 7)',
        colors: ['Gray', 'Silver'],
        features: ['S Pen Included', 'DeX Mode'],
        type: 'tablet'
    },
    'Tab S10 Ultra 5G': {
        display: '14.6" Dynamic AMOLED 2X (120Hz, QHD+)',
        processor: 'MediaTek Dimensity 9300+ (4nm)',
        camera: '13MP + 8MP UW | Dual 12MP Front',
        battery: '11,200mAh, 45W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Graphite', 'Platinum Silver'],
        features: ['S Pen Included', 'IP68 Water Resistant', 'DeX Mode'],
        type: 'tablet'
    },
    'Tab S10+ 5G': {
        display: '12.4" Dynamic AMOLED 2X (120Hz)',
        processor: 'MediaTek Dimensity 9300+ (4nm)',
        camera: '13MP + 8MP UW | 12MP Front',
        battery: '10,090mAh, 45W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Graphite', 'Platinum Silver'],
        features: ['S Pen Included', 'DeX Mode'],
        type: 'tablet'
    },
    'Tab S10 FE+ 5G': {
        display: '12.4" TFT LCD (90Hz)',
        processor: 'Samsung Exynos 1380 (5nm)',
        camera: '8MP | 12MP Front',
        battery: '10,090mAh, 45W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Graphite', 'Silver'],
        features: ['S Pen Support (sold separately)', 'DeX Mode'],
        type: 'tablet'
    },
    'Tab S10 FE 5G': {
        display: '10.9" TFT LCD (90Hz)',
        processor: 'Samsung Exynos 1380 (5nm)',
        camera: '8MP | 12MP Front',
        battery: '8000mAh, 45W Fast Charging',
        os: 'Android 14 (One UI 6.1)',
        colors: ['Graphite', 'Silver'],
        features: ['S Pen Support (sold separately)'],
        type: 'tablet'
    },
    'Tab A9+ 5G': {
        display: '11.0" LCD (90Hz, WUXGA)',
        processor: 'Qualcomm Snapdragon 695 5G',
        camera: '8MP | 5MP Front',
        battery: '7040mAh, 15W Charging',
        os: 'Android 13 (One UI 5.1)',
        colors: ['Graphite', 'Silver', 'Navy'],
        features: ['Quad Speakers', 'SD Card Slot'],
        type: 'tablet'
    },
    'Tab A11 LTE': {
        display: '11.0" LCD (90Hz)',
        processor: 'MediaTek Helio G99',
        camera: '8MP | 5MP Front',
        battery: '7040mAh, 15W Charging',
        os: 'Android 14 (One UI 6)',
        colors: ['Graphite', 'Silver'],
        features: ['Quad Speakers', 'SD Card Slot (up to 1TB)'],
        type: 'tablet'
    },
    'Tab A9 LTE': {
        display: '8.7" LCD (60Hz)',
        processor: 'MediaTek Helio G99',
        camera: '8MP | 2MP Front',
        battery: '5100mAh, 15W Charging',
        os: 'Android 13 (One UI 5.1)',
        colors: ['Graphite', 'Silver', 'Navy'],
        features: ['Compact Size', 'SD Card Slot'],
        type: 'tablet'
    },

    // === WEARABLES ===
    'Watch Ultra': {
        display: '1.47" Super AMOLED (3000 nits)',
        processor: 'Exynos W1000 (3nm)',
        camera: 'N/A',
        battery: '590mAh (60-80 hours)',
        os: 'Wear OS 6 (One UI 8 Watch)',
        colors: ['Titanium Blue', 'Titanium Gray', 'Titanium Silver', 'Titanium White'],
        features: ['Titanium + Sapphire Glass', 'Emergency Siren (86dB)', 'BioActive Sensor', '10ATM + IP68'],
        type: 'wearable'
    },
    'Watch 8 Classic': {
        display: '1.5" Super AMOLED (Rotating Bezel)',
        processor: 'Exynos W1000 (3nm)',
        camera: 'N/A',
        battery: '425mAh (40 hours)',
        os: 'Wear OS 6 (One UI 8 Watch)',
        colors: ['Black', 'Silver'],
        features: ['Rotating Bezel', 'Titanium Build', 'BioActive Sensor', '5ATM + IP68'],
        type: 'wearable'
    },
    'Watch 8': {
        display: '1.5" / 1.3" Super AMOLED',
        processor: 'Exynos W1000 (3nm)',
        camera: 'N/A',
        battery: '425mAh / 300mAh',
        os: 'Wear OS 6 (One UI 8 Watch)',
        colors: ['Black', 'Silver', 'Pink Gold'],
        features: ['Aluminum Build', 'BioActive Sensor', '5ATM + IP68'],
        type: 'wearable'
    },
    'Watch7 BT': {
        display: '1.5" / 1.3" Super AMOLED',
        processor: 'Exynos W1000 (3nm)',
        camera: 'N/A',
        battery: '425mAh / 300mAh',
        os: 'Wear OS 5 (One UI 6 Watch)',
        colors: ['Green', 'Cream', 'Silver'],
        features: ['Aluminum Build', 'BioActive Sensor', '5ATM + IP68'],
        type: 'wearable'
    },
    'Watch FE BT': {
        display: '1.2" Super AMOLED (396x396)',
        processor: 'Exynos W920 (5nm)',
        camera: 'N/A',
        battery: '247mAh (30 hours)',
        os: 'Wear OS 4 (One UI 5 Watch)',
        colors: ['Black', 'Pink Gold', 'Silver'],
        features: ['Aluminum Build', 'Heart Rate Monitor', '5ATM + IP68'],
        type: 'wearable'
    },
    'Buds3 Pro': {
        display: 'N/A',
        processor: 'N/A',
        camera: 'N/A',
        battery: '6 hrs (ANC on) + 20 hrs (case)',
        os: 'Galaxy Wearable App',
        colors: ['Silver', 'White'],
        features: ['Adaptive ANC', '24-bit Hi-Res Audio', 'IP57', 'Blade Lights LED', 'Bluetooth 5.4'],
        type: 'wearable'
    },
    'Buds3': {
        display: 'N/A',
        processor: 'N/A',
        camera: 'N/A',
        battery: '6 hrs + 24 hrs (case)',
        os: 'Galaxy Wearable App',
        colors: ['Silver', 'White'],
        features: ['Active Noise Cancellation', 'IP57', 'Bluetooth 5.4'],
        type: 'wearable'
    },
    'Buds2 Pro': {
        display: 'N/A',
        processor: 'N/A',
        camera: 'N/A',
        battery: '5 hrs (ANC) + 18 hrs (case)',
        os: 'Galaxy Wearable App',
        colors: ['Graphite', 'White', 'Bora Purple'],
        features: ['Intelligent ANC', '24-bit Hi-Fi Audio', 'IPX7', '360 Audio'],
        type: 'wearable'
    },
    'Buds FE': {
        display: 'N/A',
        processor: 'N/A',
        camera: 'N/A',
        battery: '6 hrs (ANC) + 21 hrs (case)',
        os: 'Galaxy Wearable App',
        colors: ['Graphite', 'White'],
        features: ['Active Noise Cancellation', 'IPX2', 'Bass Boost'],
        type: 'wearable'
    },
    'Buds Core': {
        display: 'N/A',
        processor: 'N/A',
        camera: 'N/A',
        battery: '5 hrs + 12 hrs (case)',
        os: 'Galaxy Wearable App',
        colors: ['Black', 'White'],
        features: ['Semi In-ear Design', 'Bluetooth 5.3', 'USB-C Charging'],
        type: 'wearable'
    },
    'Fit 3': {
        display: '1.6" AMOLED (256x402)',
        processor: 'N/A',
        camera: 'N/A',
        battery: '13 days (typical usage)',
        os: 'Samsung Health App',
        colors: ['Gray', 'Pink Gold', 'Silver'],
        features: ['100+ Workout Modes', 'Heart Rate Monitor', 'SpO2', '5ATM Waterproof', 'Fall Detection'],
        type: 'wearable'
    },
    'Smart Tag 2': {
        display: 'N/A',
        processor: 'N/A',
        camera: 'N/A',
        battery: '500 days (replaceable)',
        os: 'SmartThings App',
        colors: ['Black', 'White'],
        features: ['UWB + BLE', 'Lost Mode Alert', 'IP67 Water Resistant', 'Compass View'],
        type: 'wearable'
    }
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from user's price list)
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // A-Series (High)
    { model: 'A56 5G', storage: '256GB', ram: '8GB', rdp: 576170, rrp: 609000 },
    { model: 'A56 5G', storage: '128GB', ram: '8GB', rdp: 539600, rrp: 571000 },
    { model: 'A36 5G', storage: '256GB', ram: '8GB', rdp: 496920, rrp: 526000 },
    { model: 'A36 5G', storage: '128GB', ram: '6GB', rdp: 428340, rrp: 453000 },
    { model: 'A26 5G', storage: '256GB', ram: '8GB', rdp: 395910, rrp: 418500 },
    { model: 'A26 5G', storage: '128GB', ram: '6GB', rdp: 342120, rrp: 362000 },
    // A-Series (Mid)
    { model: 'A17 5G', storage: '128GB', ram: '4GB', rdp: 229080, rrp: 242500 },
    { model: 'A17 LTE', storage: '256GB', ram: '8GB', rdp: 273070, rrp: 288500 },
    { model: 'A17 LTE', storage: '128GB', ram: '6GB', rdp: 221970, rrp: 234500 },
    { model: 'A17 LTE', storage: '128GB', ram: '4GB', rdp: 204940, rrp: 216500 },
    { model: 'A16 LTE', storage: '128GB', ram: '4GB', rdp: 185170, rrp: 196000 },
    // A-Series (Low/Budget)
    { model: 'A07', storage: '128GB', ram: '4GB', rdp: 144500, rrp: 150800 },
    { model: 'A07', storage: '64GB', ram: '4GB', rdp: 130380, rrp: 136100 },
    { model: 'A06 5G', storage: '64GB', ram: '4GB', rdp: 174810, rrp: 182800 },
    { model: 'A06 LTE', storage: '128GB', ram: '4GB', rdp: 132960, rrp: 138800 },
    { model: 'A06 LTE', storage: '64GB', ram: '4GB', rdp: 112560, rrp: 117300 },
    // Tablets
    { model: 'Tab S11 Ultra 5G', storage: '512GB', ram: '12GB', rdp: 1823880, rrp: 1960000 },
    { model: 'Tab S11 Ultra 5G', storage: '256GB', ram: '12GB', rdp: 1676730, rrp: 1802000 },
    { model: 'Tab S11 5G', storage: '256GB', ram: '8GB', rdp: 1259550, rrp: 1353000 },
    { model: 'Tab S11 5G', storage: '128GB', ram: '8GB', rdp: 1185230, rrp: 1274000 },
    { model: 'Tab S10 Ultra 5G', storage: '512GB', ram: '12GB', rdp: 2222610, rrp: 2388000, note: 'w/Keyboard' },
    { model: 'Tab S10 Ultra 5G', storage: '256GB', ram: '12GB', rdp: 2103180, rrp: 2260000, note: 'w/Keyboard' },
    { model: 'Tab S10 Ultra 5G', storage: '512GB', ram: '12GB', rdp: 1827100, rrp: 1963000 },
    { model: 'Tab S10 Ultra 5G', storage: '256GB', ram: '12GB', rdp: 1713880, rrp: 1863000 },
    { model: 'Tab S10+ 5G', storage: '256GB', ram: '12GB', rdp: 1735590, rrp: 1865500, note: 'w/Keyboard' },
    { model: 'Tab S10+ 5G', storage: '256GB', ram: '12GB', rdp: 1459510, rrp: 1568500 },
    { model: 'Tab S10 FE+ 5G', storage: '256GB', ram: '8GB', rdp: 939410, rrp: 1009000 },
    { model: 'Tab S10 FE 5G', storage: '128GB', ram: '8GB', rdp: 754340, rrp: 811000 },
    { model: 'Tab A9+ 5G', storage: '128GB', ram: '8GB', rdp: 283840, rrp: 305000 },
    { model: 'Tab A9+ 5G', storage: '64GB', ram: '4GB', rdp: 245060, rrp: 263000 },
    { model: 'Tab A11 LTE', storage: '128GB', ram: '4GB', rdp: 197510, rrp: 213000 },
    { model: 'Tab A11 LTE', storage: '64GB', ram: '4GB', rdp: 167510, rrp: 180000 },
    { model: 'Tab A9 LTE', storage: '128GB', ram: '4GB', rdp: 195430, rrp: 210000 },
    { model: 'Tab A9 LTE', storage: '64GB', ram: '4GB', rdp: 164410, rrp: 177000 },
    // Wearables
    { model: 'Watch Ultra', rdp: 625260, rrp: 672000 },
    { model: 'Watch 8 Classic', rdp: 476460, rrp: 512000 },
    { model: 'Watch 8', storage: 'Large', rdp: 364510, rrp: 391500 },
    { model: 'Watch 8', storage: 'Small', rdp: 337180, rrp: 362000 },
    { model: 'Watch7 BT', storage: '44mm', rdp: 354330, rrp: 381000 },
    { model: 'Watch7 BT', storage: '40mm', rdp: 322470, rrp: 346000 },
    { model: 'Watch FE BT', rdp: 221020, rrp: 237500 },
    { model: 'Buds3 Pro', rdp: 207310, rrp: 223000 },
    { model: 'Buds3', rdp: 166190, rrp: 179000 },
    { model: 'Fit 3', rdp: 64520, rrp: 69000 },
    { model: 'Smart Tag 2', rdp: 24430, rrp: 26000 },
    { model: 'Buds2 Pro', rdp: 216370, rrp: 232000 },
    { model: 'Buds FE', rdp: 110900, rrp: 119000 },
    { model: 'Buds Core', rdp: 51450, rrp: 55000 },
];

// ------------------------------------------------------------------
// 3. DESCRIPTION GENERATOR (Full EAV + BNPL)
// ------------------------------------------------------------------
function generateDescription(
    model: string,
    fullName: string,
    rrp: number,
    specs: any,
    metadata: any
) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(rrp);
    const monthlyPayment = Math.ceil(rrp / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    const isPhone = specs.type === 'phone';
    const isTablet = specs.type === 'tablet';
    const isWearable = specs.type === 'wearable';

    let description = `
## Samsung Galaxy ${model} Price in Nigeria

The **${fullName}** is available at Ogabassey for **${priceStr}**${isPhone || isTablet ? `, or pay **${bnplStr}/month × 10** via BNPL` : ''}. `;

    if (isPhone) {
        description += `Powered by the **${specs.processor}** and featuring a stunning **${specs.display}**, this ${metadata.storage || ''} model delivers flagship Samsung performance. Brand new with official warranty.`;
    } else if (isTablet) {
        description += `Featuring a massive **${specs.display}** and the powerful **${specs.processor}**, this tablet is perfect for work and entertainment. Brand new with official warranty.`;
    } else if (isWearable) {
        description += specs.battery !== 'N/A' ? `With **${specs.battery}** battery life and premium features, this wearable is designed for your active lifestyle.` : 'An essential Samsung accessory for your connected lifestyle.';
    }

    description += `

## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | Samsung Galaxy ${model} |
| **Price** | ${priceStr} |`;

    if (metadata.ram) description += `\n| **RAM** | ${metadata.ram} |`;
    if (metadata.storage) description += `\n| **Storage** | ${metadata.storage} |`;
    if (specs.display !== 'N/A') description += `\n| **Display** | ${specs.display} |`;
    if (specs.processor !== 'N/A') description += `\n| **Processor** | ${specs.processor} |`;
    if (specs.camera !== 'N/A') description += `\n| **Camera** | ${specs.camera} |`;
    if (specs.battery !== 'N/A') description += `\n| **Battery** | ${specs.battery} |`;
    if (specs.os !== 'N/A') description += `\n| **OS** | ${specs.os} |`;
    description += `\n| **Features** | ${specs.features.join(', ')} |`;
    description += `\n| **Colors** | ${specs.colors.join(', ')} |`;

    description += `

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR **₦${monthlyPayment.toLocaleString()}/month × 10** (BNPL)
- ✅ **Guaranteed Quality:** Brand New (Sealed) with Official Samsung Warranty
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [iPhone 16 Pro Max](/ogabassey/apple) - iOS Flagship Alternative
- [Google Pixel 9 Pro XL](/ogabassey/smartphones) - Pixel Alternative
- [Samsung Galaxy Tab S11](/ogabassey/samsung) - Premium Tablet
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedSamsungWithFullSpecs() {
    console.log("📱 Starting Samsung Re-Seed with Full EAV Specs...\n");

    // A. Get Parent Category
    const { data: smartphonesCategory } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'smartphones').single();
    if (!smartphonesCategory) {
        console.error("❌ 'Smartphones' category not found.");
        return;
    }
    const merchantId = smartphonesCategory.merchant_id;

    // B. Ensure Samsung Category
    let { data: samsungCat } = await supabase.from('categories').select('id').eq('slug', 'samsung').maybeSingle();
    if (!samsungCat) {
        console.log("✨ Creating 'Samsung' category...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Samsung',
            slug: 'samsung',
            parent_id: smartphonesCategory.id,
            merchant_id: merchantId,
            description: 'Shop Samsung Galaxy phones, tablets, wearables & accessories in Nigeria.',
            seo_heading: 'Buy Samsung Galaxy Phones, Tablets & Wearables in Nigeria',
            seo_description: 'Shop latest Samsung Galaxy A56, A36, Tab S11, Galaxy Watch Ultra, Buds3 Pro and more at best prices in Nigeria. Brand new with official warranty.',
            seo_features: ["Official Samsung Warranty", "Pay Small Small (BNPL)", "Same-Day Lagos Delivery", "Galaxy AI Features"],
            seo_faq: [
                { question: "What is the price of Samsung A56 in Nigeria?", answer: "The Samsung Galaxy A56 5G price starts from ₦571,000 for the 128GB model at Ogabassey." },
                { question: "Is Samsung A36 5G waterproof?", answer: "Yes, the Samsung Galaxy A36 5G has IP67 rating for water and dust resistance." },
                { question: "Can I pay in installments for Samsung products?", answer: "Yes! All Samsung products are available for BNPL (Buy Now Pay Later) at Ogabassey." }
            ]
        }).select().single();
        samsungCat = newCat;
        console.log("✅ Created Samsung category\n");
    }
    const categoryId = samsungCat?.id;

    // C. Seed Products
    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} Samsung products with full specs...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = SAMSUNG_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs for ${p.model}, skipping.`);
            continue;
        }

        // Build full name
        let fullName = `Samsung Galaxy ${p.model}`;
        if (p.ram && p.storage) {
            fullName += ` ${p.ram} ${p.storage}`;
        } else if ((p as any).storage) {
            fullName += ` ${(p as any).storage}`;
        }
        if ((p as any).note) fullName += ` (${(p as any).note})`;
        fullName += ' (New)';

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
            model: p.model,
            condition: 'New',
        };
        if (p.ram) metadata.ram = p.ram;
        if (p.storage) metadata.storage = p.storage;

        const description = generateDescription(p.model, fullName, p.rrp, specs, metadata);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      Cost: ₦${p.rdp.toLocaleString()} | Sell: ₦${p.rrp.toLocaleString()}`);

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.rrp,
            cost_price: p.rdp,
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Samsung',
            status: 'active',
            stock: 10,
            condition: 'new'
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            if (categoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            }
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n🏁 Samsung Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedSamsungWithFullSpecs().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
