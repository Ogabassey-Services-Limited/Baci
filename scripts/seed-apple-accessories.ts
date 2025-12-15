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
// Category Mapping (Correct Hierarchy)
// ------------------------------------------------------------------
// iPads → Tablets
// Apple Watch → Wearables  
// AirPods → Audio
// Apple Pencil/Magic → Accessories
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 1. PRODUCT SPECS
// ------------------------------------------------------------------
const IPAD_SPECS: Record<string, any> = {
    'iPad Air 4th Gen 2020': {
        display: '10.9" Liquid Retina IPS LCD',
        processor: 'A14 Bionic',
        camera: '12MP Wide | 7MP FaceTime HD',
        battery: '28.6Wh, 20W Fast Charging',
        os: 'iPadOS 14 (Upgradable to iPadOS 18)',
        features: ['Touch ID', 'Apple Pencil 2', 'Magic Keyboard Support'],
        releaseYear: 2020
    },
    'iPad Air 5th Gen 2021 M1': {
        display: '10.9" Liquid Retina IPS LCD',
        processor: 'Apple M1',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '28.6Wh, 20W Fast Charging',
        os: 'iPadOS 15 (Upgradable to iPadOS 18)',
        features: ['M1 Chip', 'Center Stage', '5G Optional'],
        releaseYear: 2022
    },
    'iPad Air 6th Gen 2024 M2': {
        display: '11" / 13" Liquid Retina',
        processor: 'Apple M2',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '28.93Wh / 36.59Wh, 20W Fast Charging',
        os: 'iPadOS 17 (Upgradable to iPadOS 18)',
        features: ['M2 Chip', 'Landscape Camera', 'Wi-Fi 6E'],
        releaseYear: 2024
    },
    'iPad Air 7th Gen 2025 M3': {
        display: '11" / 13" Liquid Retina XDR',
        processor: 'Apple M3',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '30Wh / 38Wh, 30W Fast Charging',
        os: 'iPadOS 19',
        features: ['M3 Chip', 'Apple Intelligence', 'Thunderbolt'],
        releaseYear: 2025
    },
    'iPad Mini 6th Gen 2021': {
        display: '8.3" Liquid Retina IPS LCD',
        processor: 'A15 Bionic',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '19.3Wh, 20W Fast Charging',
        os: 'iPadOS 15 (Upgradable to iPadOS 18)',
        features: ['Compact Size', 'Touch ID', 'Apple Pencil 2'],
        releaseYear: 2021
    },
    'iPad 9th Gen 2021': {
        display: '10.2" Retina IPS LCD',
        processor: 'A13 Bionic',
        camera: '8MP Wide | 12MP Ultra Wide FaceTime',
        battery: '32.4Wh, 20W Fast Charging',
        os: 'iPadOS 15 (Upgradable to iPadOS 18)',
        features: ['True Tone', 'Center Stage', 'Apple Pencil 1'],
        releaseYear: 2021
    },
    'iPad 10th Gen 2022': {
        display: '10.9" Liquid Retina IPS LCD',
        processor: 'A14 Bionic',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '28.6Wh, 20W Fast Charging',
        os: 'iPadOS 16 (Upgradable to iPadOS 18)',
        features: ['New Design', 'Landscape Camera', 'USB-C'],
        releaseYear: 2022
    },
    'iPad 11th Gen 2024': {
        display: '10.9" Liquid Retina IPS LCD',
        processor: 'A16 Bionic',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '28.6Wh, 20W Fast Charging',
        os: 'iPadOS 18',
        features: ['A16 Bionic', 'Apple Pencil Pro', 'Wi-Fi 6E'],
        releaseYear: 2024
    },
    'iPad Pro 2021 M1': {
        display: '11" / 12.9" Liquid Retina XDR',
        processor: 'Apple M1',
        camera: '12MP Wide + 10MP Ultra Wide + LiDAR | 12MP TrueDepth',
        battery: '28.65Wh / 40.88Wh, 20W Fast Charging',
        os: 'iPadOS 14 (Upgradable to iPadOS 18)',
        features: ['M1 Chip', 'Thunderbolt', 'Mini-LED (12.9")'],
        releaseYear: 2021
    },
};

const WATCH_SPECS: Record<string, any> = {
    'Apple Watch SE 2022': {
        display: '40mm/44mm Retina LTPO OLED',
        processor: 'S8 SiP',
        features: ['Fall Detection', 'Crash Detection', 'Heart Rate'],
        battery: '18 hours',
        os: 'watchOS 9 (Upgradable to watchOS 11)',
        releaseYear: 2022
    },
    'Apple Watch Series 8': {
        display: '41mm/45mm Always-On Retina LTPO OLED',
        processor: 'S8 SiP',
        features: ['Temperature Sensing', 'Crash Detection', 'Blood Oxygen'],
        battery: '18 hours (36 Low Power)',
        os: 'watchOS 9 (Upgradable to watchOS 11)',
        releaseYear: 2022
    },
    'Apple Watch Series 9': {
        display: '41mm/45mm Always-On Retina LTPO OLED (2000 nits)',
        processor: 'S9 SiP',
        features: ['Double Tap', 'Precision Finding', 'On-Device Siri'],
        battery: '18 hours (36 Low Power)',
        os: 'watchOS 10 (Upgradable to watchOS 11)',
        releaseYear: 2023
    },
    'Apple Watch Series 10': {
        display: '42mm/46mm Always-On Wide-Angle OLED',
        processor: 'S10 SiP',
        features: ['Thinnest Ever', 'Sleep Apnea Detection', 'Water Depth'],
        battery: '18 hours (36 Low Power)',
        os: 'watchOS 11',
        releaseYear: 2024
    },
    'Apple Watch Ultra': {
        display: '49mm Always-On Retina LTPO OLED (2000 nits)',
        processor: 'S8 SiP',
        features: ['Titanium', 'Action Button', 'Depth Gauge', 'Dual-Frequency GPS'],
        battery: '36 hours (60 Low Power)',
        os: 'watchOS 9 (Upgradable to watchOS 11)',
        releaseYear: 2022
    },
    'Apple Watch Ultra 2': {
        display: '49mm Always-On Retina LTPO OLED (3000 nits)',
        processor: 'S9 SiP',
        features: ['Titanium', 'Double Tap', 'Precision Finding', 'Depth App'],
        battery: '36 hours (72 Low Power)',
        os: 'watchOS 10 (Upgradable to watchOS 11)',
        releaseYear: 2023
    },
};

const AIRPODS_SPECS: Record<string, any> = {
    'AirPods 2': {
        features: ['H1 Chip', 'Hey Siri', 'Wireless Charging Case'],
        battery: '5 hours (24+ with case)',
        releaseYear: 2019
    },
    'AirPods 3': {
        features: ['Spatial Audio', 'Adaptive EQ', 'Force Sensor', 'MagSafe Case'],
        battery: '6 hours (30 with case)',
        releaseYear: 2021
    },
    'AirPods 4': {
        features: ['H2 Chip', 'Personalized Spatial Audio', 'USB-C Case'],
        battery: '5 hours (30 with case)',
        releaseYear: 2024
    },
    'AirPods 4 ANC': {
        features: ['H2 Chip', 'Active Noise Cancellation', 'Transparency Mode', 'USB-C'],
        battery: '5 hours (30 with case)',
        releaseYear: 2024
    },
    'AirPods Pro 2nd Gen': {
        features: ['H2 Chip', 'Active Noise Cancellation', 'Adaptive Audio', 'USB-C'],
        battery: '6 hours (30 with case)',
        releaseYear: 2023
    },
    'AirPods Pro 3rd Gen': {
        features: ['H3 Chip', 'Enhanced ANC', 'Hearing Aid Feature', 'USB-C'],
        battery: '6.5 hours (32 with case)',
        releaseYear: 2024
    },
    'AirPods Max 2': {
        features: ['H2 Chip', 'Active Noise Cancellation', 'Spatial Audio', 'USB-C'],
        battery: '20 hours',
        releaseYear: 2024
    },
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from Google Sheet position 4-5)
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // === AirPods (Audio Category) ===
    { name: 'Apple AirPods 2', specs: 'AirPods 2', price: 160000, condition: 'New', category: 'audio' },
    { name: 'Apple AirPods 2', specs: 'AirPods 2', price: 120000, condition: 'Used', category: 'audio' },
    { name: 'Apple AirPods 3', specs: 'AirPods 3', price: 180000, condition: 'New', category: 'audio' },
    { name: 'Apple AirPods 3', specs: 'AirPods 3', price: 140000, condition: 'Used', category: 'audio' },
    { name: 'Apple AirPods 4', specs: 'AirPods 4', price: 190000, condition: 'New', category: 'audio' },
    { name: 'Apple AirPods 4', specs: 'AirPods 4', price: 140000, condition: 'Used', category: 'audio' },
    { name: 'Apple AirPods 4 ANC', specs: 'AirPods 4 ANC', price: 260000, condition: 'New', category: 'audio' },
    { name: 'Apple AirPods 4 ANC', specs: 'AirPods 4 ANC', price: 190000, condition: 'Used', category: 'audio' },
    { name: 'Apple AirPods Pro 2nd Gen Type C', specs: 'AirPods Pro 2nd Gen', price: 300000, condition: 'New', category: 'audio' },
    { name: 'Apple AirPods Pro 2nd Gen Type C', specs: 'AirPods Pro 2nd Gen', price: 210000, condition: 'Used', category: 'audio' },
    { name: 'Apple AirPods Pro', specs: 'AirPods Pro 2nd Gen', price: 170000, condition: 'Used', category: 'audio' },
    { name: 'Apple AirPods Pro 3rd Gen', specs: 'AirPods Pro 3rd Gen', price: 385000, condition: 'New', category: 'audio' },
    { name: 'Apple AirPods Max 2 USB-C', specs: 'AirPods Max 2', price: 750000, condition: 'New', category: 'audio' },

    // === Apple Watch (Wearables Category) ===
    { name: 'Apple Watch SE 2022 40mm GPS', specs: 'Apple Watch SE 2022', price: 260000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch SE 2022 40mm GPS LTE', specs: 'Apple Watch SE 2022', price: 280000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch SE 2022 44mm GPS', specs: 'Apple Watch SE 2022', price: 300000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch SE 2022 44mm GPS LTE', specs: 'Apple Watch SE 2022', price: 310000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 8 45mm GPS', specs: 'Apple Watch Series 8', price: 370000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 8 45mm LTE', specs: 'Apple Watch Series 8', price: 390000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 9 41mm GPS', specs: 'Apple Watch Series 9', price: 410000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 9 41mm LTE', specs: 'Apple Watch Series 9', price: 430000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 9 45mm GPS', specs: 'Apple Watch Series 9', price: 450000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 9 45mm LTE', specs: 'Apple Watch Series 9', price: 470000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 10 42mm GPS', specs: 'Apple Watch Series 10', price: 495000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Series 10 46mm GPS', specs: 'Apple Watch Series 10', price: 550000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Ultra 49mm', specs: 'Apple Watch Ultra', price: 920000, condition: 'New', category: 'wearables' },
    { name: 'Apple Watch Ultra 2 49mm', specs: 'Apple Watch Ultra 2', price: 1000000, condition: 'New', category: 'wearables' },

    // === Apple Pencil & Magic (Accessories Category) ===
    { name: 'Apple Pencil 2', price: 150000, condition: 'New', category: 'accessories' },
    { name: 'Apple Pencil 2', price: 100000, condition: 'Used', category: 'accessories' },
    { name: 'Apple Pencil 3', price: 170000, condition: 'New', category: 'accessories' },
    { name: 'Apple Pencil USB-C', price: 150000, condition: 'New', category: 'accessories' },
    { name: 'Apple Pencil USB-C', price: 130000, condition: 'Used', category: 'accessories' },
    { name: 'Apple Pencil Pro', price: 195000, condition: 'New', category: 'accessories' },
    { name: 'Apple Pencil Pro', price: 155000, condition: 'Openbox', category: 'accessories' },
    { name: 'Apple Magic Keyboard 11" M4', price: 430000, condition: 'New', category: 'accessories' },
    { name: 'Apple Magic Keyboard 11" M4', price: 300000, condition: 'Used', category: 'accessories' },
    { name: 'Apple Magic Keyboard 13" M4', price: 520000, condition: 'New', category: 'accessories' },
    { name: 'Apple Magic Keyboard 13" M4', price: 380000, condition: 'Used', category: 'accessories' },
    { name: 'Apple Magic Mouse 1', price: 90000, condition: 'Used', category: 'accessories' },
    { name: 'Apple Magic Mouse 3', price: 110000, condition: 'New', category: 'accessories' },
    { name: 'Apple Fast Charger 20W', price: 10000, condition: 'New', category: 'accessories' },

    // === iPads (Tablets Category) ===
    { name: 'iPad Air 4th Gen 2020 256GB WiFi + Cellular', specs: 'iPad Air 4th Gen 2020', price: 670000, condition: 'New', category: 'tablets', size: '10.9"' },
    { name: 'iPad Air 6th Gen 2024 M2 256GB WiFi', specs: 'iPad Air 6th Gen 2024 M2', price: 940000, condition: 'New', category: 'tablets', size: '11"' },
    { name: 'iPad Air 6th Gen 2024 M2 128GB WiFi', specs: 'iPad Air 6th Gen 2024 M2', price: 1070000, condition: 'New', category: 'tablets', size: '13"' },
    { name: 'iPad Air 7th Gen 2025 M3 128GB WiFi', specs: 'iPad Air 7th Gen 2025 M3', price: 760000, condition: 'New', category: 'tablets', size: '11"' },
    { name: 'iPad Air 7th Gen 2025 M3 256GB WiFi', specs: 'iPad Air 7th Gen 2025 M3', price: 980000, condition: 'New', category: 'tablets', size: '11"' },
    { name: 'iPad Air 7th Gen 2025 M3 256GB WiFi + Cellular', specs: 'iPad Air 7th Gen 2025 M3', price: 1200000, condition: 'New', category: 'tablets', size: '11"' },
    { name: 'iPad Mini 6th Gen 2021 64GB WiFi', specs: 'iPad Mini 6th Gen 2021', price: 470000, condition: 'Premium Used', category: 'tablets', size: '8.3"' },
    { name: 'iPad Mini 6th Gen 2021 256GB WiFi + Cellular', specs: 'iPad Mini 6th Gen 2021', price: 630000, condition: 'Premium Used', category: 'tablets', size: '8.3"' },
    { name: 'iPad 9th Gen 2021 256GB WiFi', specs: 'iPad 9th Gen 2021', price: 350000, condition: 'Premium Used', category: 'tablets', size: '10.2"' },
    { name: 'iPad 9th Gen 2021 256GB WiFi + Cellular', specs: 'iPad 9th Gen 2021', price: 400000, condition: 'Premium Used', category: 'tablets', size: '10.2"' },
    { name: 'iPad 10th Gen 2022 64GB WiFi', specs: 'iPad 10th Gen 2022', price: 440000, condition: 'Premium Used', category: 'tablets', size: '10.9"' },
    { name: 'iPad 10th Gen 2022 64GB WiFi + Cellular', specs: 'iPad 10th Gen 2022', price: 495000, condition: 'Premium Used', category: 'tablets', size: '10.9"' },
    { name: 'iPad 10th Gen 2022 256GB WiFi', specs: 'iPad 10th Gen 2022', price: 590000, condition: 'Premium Used', category: 'tablets', size: '10.9"' },
    { name: 'iPad 11th Gen 2024 128GB WiFi', specs: 'iPad 11th Gen 2024', price: 480000, condition: 'Premium Used', category: 'tablets', size: '10.9"' },
    { name: 'iPad 11th Gen 2024 128GB LTE', specs: 'iPad 11th Gen 2024', price: 540000, condition: 'Premium Used', category: 'tablets', size: '10.9"' },
];

// ------------------------------------------------------------------
// 3. DESCRIPTION GENERATOR
// ------------------------------------------------------------------
function generateDescription(product: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.price);
    const monthlyPayment = Math.ceil(product.price / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    let description = `## ${product.name} Price in Nigeria\n\n`;
    description += `The **${product.name}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;

    if (specs) {
        if (specs.processor) description += `Powered by **${specs.processor}**.`;
        if (specs.features) description += ` Features include ${specs.features.slice(0, 3).join(', ')}.`;
    }

    description += ` Condition: **${product.condition}**.`;

    description += `\n\n## Key Specifications

| Spec | Value |
|------|-------|
| **Product** | ${product.name} |
| **Price** | ${priceStr} |
| **Condition** | ${product.condition} |`;

    if (specs) {
        if (specs.display) description += `\n| **Display** | ${specs.display} |`;
        if (specs.processor) description += `\n| **Processor** | ${specs.processor} |`;
        if (specs.battery) description += `\n| **Battery** | ${specs.battery} |`;
        if (specs.features) description += `\n| **Features** | ${specs.features.join(', ')} |`;
    }

    description += `

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR **₦${monthlyPayment.toLocaleString()}/month × 10** (BNPL)
- ✅ **Guaranteed Quality:** ${product.condition === 'New' ? 'Brand New (Sealed)' : 'Verified Authentic'}
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [iPhone 16 Pro Max](/ogabassey/apple) - Latest iPhone
- [Samsung Galaxy S25 Ultra](/ogabassey/samsung) - Android Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedAppleAccessories() {
    console.log("📱 Starting Apple Accessories Import...\n");

    // Get merchant ID from any existing category
    const { data: smartphonesCategory } = await supabase.from('categories').select('merchant_id').eq('slug', 'smartphones').single();
    if (!smartphonesCategory) {
        console.error("❌ Could not find merchant.");
        return;
    }
    const merchantId = smartphonesCategory.merchant_id;

    // Get parent category IDs
    const categoryMap: Record<string, string> = {};
    const categories = ['audio', 'wearables', 'accessories', 'tablets'];

    for (const cat of categories) {
        const { data } = await supabase.from('categories').select('id').eq('slug', cat).single();
        if (data) {
            categoryMap[cat] = data.id;
            console.log(`✅ Found category: ${cat} -> ${data.id}`);
        } else {
            console.warn(`⚠️ Category not found: ${cat}`);
        }
    }

    // Seed Products
    console.log(`\n🌱 Seeding ${PRODUCTS_TO_SEED.length} Apple products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const fullName = `${p.name} (${p.condition})`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            skipped++;
            continue;
        }

        const specs = (p as any).specs ?
            (IPAD_SPECS[(p as any).specs] || WATCH_SPECS[(p as any).specs] || AIRPODS_SPECS[(p as any).specs]) : null;

        const metadata: any = {
            brand: 'Apple',
            condition: p.condition,
        };
        if ((p as any).size) metadata.size = (p as any).size;
        if (specs?.releaseYear) metadata.releaseYear = specs.releaseYear;

        const description = generateDescription(p, specs);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      Price: ₦${p.price.toLocaleString()} | Category: ${p.category}`);

        // Map condition
        const dbCondition = p.condition.toLowerCase().includes('used') ||
            p.condition.toLowerCase().includes('premium') ||
            p.condition.toLowerCase().includes('openbox') ? 'used' : 'new';

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.85),
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: p.category,
            status: 'active',
            stock: 5,
            condition: dbCondition,
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            // Link to category
            const categoryId = categoryMap[p.category];
            if (categoryId) {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            }
            console.log(`   ✅ Created & Linked to ${p.category}`);
            created++;
        }
    }

    console.log(`\n🏁 Apple Accessories Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedAppleAccessories().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
