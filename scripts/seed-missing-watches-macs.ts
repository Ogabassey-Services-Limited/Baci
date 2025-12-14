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
// APPLE WATCH SPECS
// ------------------------------------------------------------------
const WATCH_SPECS: Record<string, any> = {
    'Apple Watch Series 3': {
        display: '38mm/42mm OLED Retina',
        processor: 'Apple S3',
        features: ['GPS', 'LTE Optional', 'Water Resistant 50m'],
        battery: '18 hours',
        releaseYear: 2017
    },
    'Apple Watch Series 4': {
        display: '40mm/44mm OLED LTPO',
        processor: 'Apple S4',
        features: ['Fall Detection', 'ECG', 'Larger Display'],
        battery: '18 hours',
        releaseYear: 2018
    },
    'Apple Watch Series 5': {
        display: '40mm/44mm Always-On OLED LTPO',
        processor: 'Apple S5',
        features: ['Always-On Display', 'Compass', 'International Emergency'],
        battery: '18 hours',
        releaseYear: 2019
    },
    'Apple Watch Series 6': {
        display: '40mm/44mm Always-On OLED LTPO',
        processor: 'Apple S6',
        features: ['Blood Oxygen', 'Always-On Altimeter', 'U1 Chip'],
        battery: '18 hours',
        releaseYear: 2020
    },
    'Apple Watch Series 7': {
        display: '41mm/45mm Always-On OLED LTPO (IPX6X)',
        processor: 'Apple S7',
        features: ['Larger Display', 'Faster Charging', 'Dust Resistant'],
        battery: '18 hours',
        releaseYear: 2021
    },
    'Apple Watch Series 8': {
        display: '41mm/45mm Always-On OLED LTPO',
        processor: 'Apple S8',
        features: ['Temperature Sensing', 'Crash Detection', 'Low Power Mode'],
        battery: '18 hours (36 Low Power)',
        releaseYear: 2022
    },
    'Apple Watch Series 9': {
        display: '41mm/45mm Always-On OLED LTPO (2000 nits)',
        processor: 'Apple S9',
        features: ['Double Tap', 'Precision Finding', 'On-Device Siri'],
        battery: '18 hours (36 Low Power)',
        releaseYear: 2023
    },
    'Apple Watch Series 10': {
        display: '42mm/46mm Always-On Wide-Angle OLED',
        processor: 'Apple S10',
        features: ['Thinnest Ever', 'Sleep Apnea Detection', 'Water Depth'],
        battery: '18 hours (36 Low Power)',
        releaseYear: 2024
    },
    'Apple Watch SE 2020': {
        display: '40mm/44mm OLED Retina',
        processor: 'Apple S5',
        features: ['Family Setup', 'Fall Detection', 'Compass'],
        battery: '18 hours',
        releaseYear: 2020
    },
    'Apple Watch SE 2022': {
        display: '40mm/44mm OLED Retina',
        processor: 'Apple S8',
        features: ['Crash Detection', 'Fall Detection', 'Family Setup'],
        battery: '18 hours',
        releaseYear: 2022
    },
    'Apple Watch Ultra': {
        display: '49mm Always-On OLED LTPO (2000 nits)',
        processor: 'Apple S8',
        features: ['Titanium', 'Action Button', 'Depth Gauge', 'Dual GPS'],
        battery: '36 hours (60 Low Power)',
        releaseYear: 2022
    },
};

// ------------------------------------------------------------------
// PRODUCTS TO ADD (Premium Used Apple Watches)
// ------------------------------------------------------------------
const APPLE_WATCHES = [
    // === Series 3 ===
    { name: 'Apple Watch Series 3 38mm GPS', specs: 'Apple Watch Series 3', price: 120000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 3 38mm LTE', specs: 'Apple Watch Series 3', price: 125000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 3 42mm GPS', specs: 'Apple Watch Series 3', price: 140000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 3 42mm LTE', specs: 'Apple Watch Series 3', price: 145000, condition: 'Premium Used' },

    // === Series 4 ===
    { name: 'Apple Watch Series 4 40mm GPS', specs: 'Apple Watch Series 4', price: 145000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 4 40mm LTE', specs: 'Apple Watch Series 4', price: 155000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 4 44mm GPS', specs: 'Apple Watch Series 4', price: 165000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 4 44mm LTE', specs: 'Apple Watch Series 4', price: 170000, condition: 'Premium Used' },

    // === Series 5 ===
    { name: 'Apple Watch Series 5 40mm GPS', specs: 'Apple Watch Series 5', price: 180000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 5 40mm LTE', specs: 'Apple Watch Series 5', price: 185000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 5 44mm GPS', specs: 'Apple Watch Series 5', price: 190000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 5 44mm LTE', specs: 'Apple Watch Series 5', price: 195000, condition: 'Premium Used' },

    // === Series 6 ===
    { name: 'Apple Watch Series 6 40mm GPS', specs: 'Apple Watch Series 6', price: 205000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 6 40mm LTE', specs: 'Apple Watch Series 6', price: 210000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 6 44mm GPS', specs: 'Apple Watch Series 6', price: 225000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 6 44mm LTE', specs: 'Apple Watch Series 6', price: 230000, condition: 'Premium Used' },

    // === Series 7 ===
    { name: 'Apple Watch Series 7 41mm GPS', specs: 'Apple Watch Series 7', price: 260000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 7 41mm LTE', specs: 'Apple Watch Series 7', price: 270000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 7 45mm GPS', specs: 'Apple Watch Series 7', price: 280000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 7 45mm LTE', specs: 'Apple Watch Series 7', price: 290000, condition: 'Premium Used' },

    // === Series 8 ===
    { name: 'Apple Watch Series 8 41mm GPS', specs: 'Apple Watch Series 8', price: 300000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 8 41mm LTE', specs: 'Apple Watch Series 8', price: 310000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 8 45mm GPS', specs: 'Apple Watch Series 8', price: 350000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 8 45mm LTE', specs: 'Apple Watch Series 8', price: 360000, condition: 'Premium Used' },

    // === Series 9 ===
    { name: 'Apple Watch Series 9 41mm GPS', specs: 'Apple Watch Series 9', price: 320000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 9 45mm GPS', specs: 'Apple Watch Series 9', price: 400000, condition: 'Premium Used' },

    // === Series 10 ===
    { name: 'Apple Watch Series 10 42mm GPS', specs: 'Apple Watch Series 10', price: 370000, condition: 'Premium Used' },
    { name: 'Apple Watch Series 10 46mm GPS', specs: 'Apple Watch Series 10', price: 420000, condition: 'Premium Used' },

    // === SE 2020 ===
    { name: 'Apple Watch SE 2020 40mm GPS', specs: 'Apple Watch SE 2020', price: 150000, condition: 'Premium Used' },
    { name: 'Apple Watch SE 2020 40mm LTE', specs: 'Apple Watch SE 2020', price: 155000, condition: 'Premium Used' },
    { name: 'Apple Watch SE 2020 44mm GPS', specs: 'Apple Watch SE 2020', price: 180000, condition: 'Premium Used' },
    { name: 'Apple Watch SE 2020 44mm LTE', specs: 'Apple Watch SE 2020', price: 185000, condition: 'Premium Used' },

    // === SE 2022 ===
    { name: 'Apple Watch SE 2022 40mm GPS', specs: 'Apple Watch SE 2022', price: 195000, condition: 'Premium Used' },
    { name: 'Apple Watch SE 2022 40mm LTE', specs: 'Apple Watch SE 2022', price: 200000, condition: 'Premium Used' },
    { name: 'Apple Watch SE 2022 44mm GPS', specs: 'Apple Watch SE 2022', price: 230000, condition: 'Premium Used' },
    { name: 'Apple Watch SE 2022 44mm LTE', specs: 'Apple Watch SE 2022', price: 250000, condition: 'Premium Used' },

    // === Ultra 1 ===
    { name: 'Apple Watch Ultra 49mm LTE', specs: 'Apple Watch Ultra', price: 550000, condition: 'Premium Used' },
];

// ------------------------------------------------------------------
// MISSING 15" MACBOOKS FROM PRICE LIST
// ------------------------------------------------------------------
const MACBOOK_SPECS: Record<string, any> = {
    'MacBook Pro 2015 Intel 15"': {
        display: '15.4" Retina (2880x1800)',
        processor: 'Intel Core i7 (4th Gen)',
        battery: 'Up to 9 hours',
        ports: '2x Thunderbolt 2, 2x USB 3.0, HDMI, MagSafe 2, SD Card',
        features: ['Retina Display', 'Force Touch Trackpad', '2GB AMD Graphics'],
        releaseYear: 2015
    },
    'MacBook Pro 2017 Intel 15"': {
        display: '15.4" Retina (2880x1800)',
        processor: 'Intel Core i7 (7th Gen)',
        battery: 'Up to 10 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', 'Touch ID', '4GB Radeon Pro Graphics'],
        releaseYear: 2017
    },
    'MacBook Pro 2018 Intel 15"': {
        display: '15.4" Retina (2880x1800)',
        processor: 'Intel Core i7/i9 (8th Gen)',
        battery: 'Up to 10 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', 'T2 Chip', 'True Tone', '4GB Radeon Pro'],
        releaseYear: 2018
    },
};

const MISSING_MACBOOKS = [
    // From price list - 15" models
    { name: 'MacBook Pro 15-inch 2015 i7 16GB 512GB 2GB Radeon', specs: 'MacBook Pro 2015 Intel 15"', ram: '16GB', storage: '512GB', costPrice: 430000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2017 i7 16GB 512GB 4GB Radeon TouchBar', specs: 'MacBook Pro 2017 Intel 15"', ram: '16GB', storage: '512GB', costPrice: 580000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2018 i7 16GB 512GB 4GB Radeon TouchBar', specs: 'MacBook Pro 2018 Intel 15"', ram: '16GB', storage: '512GB', costPrice: 680000, condition: 'Premium Used' },
];

// ------------------------------------------------------------------
// DESCRIPTION GENERATOR
// ------------------------------------------------------------------
function generateWatchDescription(product: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.price);
    const monthlyPayment = Math.ceil(product.price / 10);

    return `## ${product.name} Price in Nigeria

The **${product.name}** is available at Ogabassey for **${priceStr}**, or pay **₦${monthlyPayment.toLocaleString()}/month × 10** via BNPL. Features: ${specs.features.join(', ')}.

## Condition: Premium Used (Grade A)

- ✅ **Tested & Certified:** Full diagnostics passed
- ✅ **90%+ Condition:** Minor cosmetic wear only
- ✅ **Battery Health:** 80%+ verified

## Specifications

| Spec | Value |
|------|-------|
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **Battery** | ${specs.battery} |
| **Features** | ${specs.features.join(', ')} |

## Why Buy from Ogabassey?

- ✅ **BNPL:** ₦${monthlyPayment.toLocaleString()}/month × 10
- ✅ **Warranty:** 90-day warranty
- ✅ **Delivery:** Same-day Lagos, 2-5 days nationwide
`.trim();
}

function generateMacDescription(product: any, specs: any, price: number) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);
    const monthlyPayment = Math.ceil(price / 10);

    return `## ${product.name} Price in Nigeria

The **${product.name}** is available at Ogabassey for **${priceStr}**, or pay **₦${monthlyPayment.toLocaleString()}/month × 10** via BNPL. Powered by **${specs.processor}** with **${specs.display}**.

## Condition: Premium Used (Grade A)

- ✅ **Tested & Certified:** Full diagnostics passed
- ✅ **90%+ Condition:** Minor cosmetic wear only
- ✅ **Battery Health:** 80%+ verified

## Specifications

| Spec | Value |
|------|-------|
| **RAM** | ${product.ram} |
| **Storage** | ${product.storage} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **Ports** | ${specs.ports} |

## Why Buy from Ogabassey?

- ✅ **BNPL:** ₦${monthlyPayment.toLocaleString()}/month × 10
- ✅ **Warranty:** 90-day warranty
- ✅ **Delivery:** Same-day Lagos, 2-5 days nationwide
`.trim();
}

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedMissingProducts() {
    console.log("🌱 Seeding Missing Products...\n");

    // Get merchant ID
    const { data: wearablesCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'wearables').single();
    const { data: macbookCat } = await supabase.from('categories').select('id').eq('slug', 'macbook').single();

    if (!wearablesCat) {
        console.error("❌ 'Wearables' category not found.");
        return;
    }

    const merchantId = wearablesCat.merchant_id;

    // Part 1: Add Apple Watches
    console.log(`📊 Part 1: Adding ${APPLE_WATCHES.length} Premium Used Apple Watches...\n`);

    let watchCreated = 0;
    let watchSkipped = 0;

    for (const p of APPLE_WATCHES) {
        const specs = WATCH_SPECS[p.specs];
        if (!specs) continue;

        const fullName = `${p.name} (${p.condition})`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            watchSkipped++;
            continue;
        }

        const description = generateWatchDescription(p, specs);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      Price: ₦${p.price.toLocaleString()}`);

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.85),
            description: description,
            metadata: { brand: 'Apple', condition: p.condition, releaseYear: specs.releaseYear },
            category: 'Wearables',
            status: 'active',
            stock: 3,
            condition: 'used',
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: wearablesCat.id });
            console.log(`   ✅ Created & Linked to Wearables`);
            watchCreated++;
        }
    }

    console.log("\n   Watches Created:", watchCreated, "| Skipped:", watchSkipped, "\n");

    // Part 2: Add Missing MacBooks
    if (!macbookCat) {
        console.log("⚠️ MacBook category not found, skipping MacBooks");
    } else {
        console.log("📊 Part 2: Adding", MISSING_MACBOOKS.length, "Missing MacBooks...\n");

        let macCreated = 0;
        let macSkipped = 0;

        for (const p of MISSING_MACBOOKS) {
            const specs = MACBOOK_SPECS[p.specs];
            if (!specs) continue;

            const fullName = `${p.name} (${p.condition})`;
            const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

            // Check if exists
            const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
            if (existing) {
                console.log("   ⏩ Skipping existing:", fullName);
                macSkipped++;
                continue;
            }

            // Calculate price with 15% margin
            const price = Math.round(p.costPrice * 1.15 / 100) * 100;
            const description = generateMacDescription(p, specs, price);

            console.log("   ✨ Creating:", fullName);
            console.log("      Cost: ₦" + p.costPrice.toLocaleString() + " → Price: ₦" + price.toLocaleString());

            const { data: newProd, error } = await supabase.from('products').insert({
                name: fullName,
                slug: slug,
                merchant_id: merchantId,
                price: price,
                cost_price: p.costPrice,
                description: description,
                metadata: { brand: 'Apple', ram: p.ram, storage: p.storage, condition: p.condition, releaseYear: specs.releaseYear },
                category: 'Laptops',
                status: 'active',
                stock: 2,
                condition: 'used',
                condition_detail: p.condition
            }).select().single();

            if (error) {
                console.error(`   ❌ Failed: ${fullName}`, error.message);
            } else {
                await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: macbookCat.id });
                console.log(`   ✅ Created & Linked to MacBook`);
                macCreated++;
            }
        }

        console.log("\n   MacBooks Created:", macCreated, "| Skipped:", macSkipped);
    }

    console.log(`\n🏁 Seeding Complete!`);
}

seedMissingProducts();
