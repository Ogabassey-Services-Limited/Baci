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
// 1. TECNO_SPECS: Full EAV Data (Researched 2024/2025)
// ------------------------------------------------------------------
const TECNO_SPECS: Record<string, {
    display: string;
    processor: string;
    camera: string;
    battery: string;
    os: string;
    colors: string[];
    features: string[];
    type: 'phone' | 'tablet' | 'foldable';
}> = {
    // === POP SERIES (Budget) ===
    'Pop 8': {
        display: '6.6" HD+ IPS LCD (60Hz)',
        processor: 'MediaTek Helio G50',
        camera: '8MP AI Rear | 5MP Front',
        battery: '5000mAh, 10W Charging',
        os: 'Android 14 (Go Edition)',
        colors: ['Ink Black', 'Wave Blue', 'Veil White'],
        features: ['Dual SIM', 'Face Unlock', 'FM Radio'],
        type: 'phone'
    },
    'Pop 10C': {
        display: '6.6" HD+ IPS LCD (60Hz)',
        processor: 'MediaTek Helio A22',
        camera: '13MP AI Rear | 8MP Front',
        battery: '5000mAh, 10W Charging',
        os: 'Android 14 (Go Edition)',
        colors: ['Ink Black', 'Galaxy Blue', 'Pristine White'],
        features: ['Dual SIM', 'Face Unlock', 'Triple Slot'],
        type: 'phone'
    },
    'Pop 10': {
        display: '6.67" HD+ IPS LCD (90Hz)',
        processor: 'MediaTek Helio G50',
        camera: '13MP AI Rear | 8MP Front',
        battery: '5000mAh, 15W Charging',
        os: 'Android 14 (HiOS 14)',
        colors: ['Titanium Grey', 'Wave Blue', 'Veil White'],
        features: ['Dual SIM', 'Face Unlock', 'Side Fingerprint'],
        type: 'phone'
    },
    'POP 10 Pro': {
        display: '6.67" HD+ IPS LCD (120Hz)',
        processor: 'MediaTek Helio G81',
        camera: '48MP AI Rear + LED Ring Flash | 8MP Front',
        battery: '5000mAh, 18W Fast Charging',
        os: 'Android 15 (HiOS 15)',
        colors: ['Titanium Grey', 'Ripple Blue', 'Ink Black'],
        features: ['Dual SIM', 'Side Fingerprint', 'DTS Sound', 'IP54'],
        type: 'phone'
    },

    // === SPARK SERIES (Mid-Range) ===
    'Spark 40': {
        display: '6.67" FHD+ AMOLED (120Hz)',
        processor: 'MediaTek Helio G88',
        camera: '50MP AI Rear | 8MP Front',
        battery: '5000mAh, 33W Fast Charging',
        os: 'Android 14 (HiOS 14)',
        colors: ['Nebula Black', 'Skyline Blue', 'Aurora White'],
        features: ['AMOLED Display', 'Side Fingerprint', 'Stereo Speakers'],
        type: 'phone'
    },
    'Spark 40 Pro': {
        display: '6.78" FHD+ AMOLED (144Hz)',
        processor: 'MediaTek Helio G99',
        camera: '50MP AI (OIS) + 2MP Depth | 32MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 14 (HiOS 14)',
        colors: ['Nebula Black', 'Aurora White', 'Moon Titanium'],
        features: ['AMOLED 144Hz', 'OIS Camera', 'Dolby Atmos', 'NFC'],
        type: 'phone'
    },
    'Spark 40 Pro+': {
        display: '6.78" 1.5K AMOLED (144Hz, 4500 nits)',
        processor: 'MediaTek Helio G200 (6nm)',
        camera: '50MP AI (OIS) + 2MP | 13MP Front Dual Flash',
        battery: '5200mAh, 45W + 30W Wireless',
        os: 'Android 15 (HiOS 15)',
        colors: ['Nebula Black', 'Aurora White', 'Moon Titanium', 'Tundra Green'],
        features: ['Gorilla Glass 7i', 'Wireless Charging', 'IP64', 'IR Blaster'],
        type: 'phone'
    },
    'Spark 30 Pro': {
        display: '6.78" FHD+ AMOLED (120Hz)',
        processor: 'MediaTek Helio G99',
        camera: '50MP AI (OIS) + 2MP | 32MP Front',
        battery: '5000mAh, 33W Fast Charging',
        os: 'Android 14 (HiOS 14)',
        colors: ['Orbit Black', 'Alpine Blue', 'Aurora White'],
        features: ['AMOLED Display', 'OIS Camera', 'Side Fingerprint'],
        type: 'phone'
    },

    // === CAMON SERIES (Camera-Focused) ===
    'Camon 40': {
        display: '6.78" FHD+ AMOLED (144Hz)',
        processor: 'MediaTek Helio G100 (6nm)',
        camera: '50MP Sony (OIS) + 8MP UW | 50MP Front',
        battery: '5200mAh, 45W Fast Charging',
        os: 'Android 15 (HiOS 15)',
        colors: ['Galaxy Black', 'Glacier White', 'Emerald Lake Green'],
        features: ['144Hz AMOLED', '50MP Selfie', 'Dolby Atmos', 'NFC'],
        type: 'phone'
    },
    'Camon 40 Pro': {
        display: '6.78" FHD+ Curved AMOLED (144Hz)',
        processor: 'MediaTek Dimensity 7300 (4nm)',
        camera: '50MP Sony LYT-700C (OIS) + 8MP UW | 50MP Front AF',
        battery: '5200mAh, 45W Fast Charging',
        os: 'Android 15 (AI HiOS 15)',
        colors: ['Galaxy Black', 'Glacier White', 'Emerald Lake Green'],
        features: ['Curved AMOLED', 'AI Camera', 'IP68/IP69', 'NFC', 'IR Blaster'],
        type: 'phone'
    },

    // === PHANTOM SERIES (Flagship Foldables) ===
    'Phantom V Flip 2': {
        display: '6.9" FHD+ AMOLED LTPO (120Hz) + 3.64" Cover',
        processor: 'MediaTek Dimensity 8020',
        camera: '50MP (OIS) + 50MP UW | 32MP Front',
        battery: '4720mAh, 45W Fast Charging',
        os: 'Android 14 (HiOS 14)',
        colors: ['Mystic Dawn', 'Karst Green'],
        features: ['Flip Foldable', 'Large 3.64" Cover Display', 'OIS Camera', '4K Video'],
        type: 'foldable'
    },
    'Phantom V Fold 2': {
        display: '7.85" LTPO AMOLED (120Hz) + 6.42" Cover',
        processor: 'MediaTek Dimensity 9000+ (4nm)',
        camera: '50MP (OIS) + 50MP 2x Tele + 50MP UW | Dual 32MP Front',
        battery: '5750mAh, 70W Fast Charging',
        os: 'Android 14 (HiOS 14)',
        colors: ['Karst Green', 'Rippling Blue'],
        features: ['Book-Style Fold', '7.85" Main Display', 'Triple 50MP Cameras', 'Gorilla Glass Victus'],
        type: 'foldable'
    },

    // === TABLETS ===
    'Megapad 10': {
        display: '10.1" FHD IPS LCD (60Hz)',
        processor: 'MediaTek Helio G80',
        camera: '8MP Rear | 5MP Front',
        battery: '6000mAh, 18W Charging',
        os: 'Android 14 (HiOS 14)',
        colors: ['Space Grey', 'Silver'],
        features: ['Quad Speakers', 'Split Screen', 'Eye Protection Mode'],
        type: 'tablet'
    },
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from user's price list)
// Sub-Dealers = cost_price, RRP = sell price
// ALL NEW CONDITION
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // Pop Series
    { model: 'Pop 8', storage: '64GB', ram: '2GB', cost: 94600, sell: 97600 },
    { model: 'Pop 10C', storage: '64GB', ram: '2GB', cost: 93200, sell: 96100 },
    { model: 'Pop 10', storage: '64GB', ram: '3GB', cost: 100200, sell: 103300 },
    { model: 'Pop 10', storage: '128GB', ram: '3GB', cost: 114000, sell: 117600 },
    { model: 'POP 10 Pro', storage: '128GB', ram: '4GB', cost: 124200, sell: 128100 },
    // Spark Series
    { model: 'Spark 40', storage: '128GB', ram: '4GB', cost: 138400, sell: 142700 },
    { model: 'Spark 40', storage: '256GB', ram: '8GB', cost: 179000, sell: 184600 },
    { model: 'Spark 40 Pro', storage: '128GB', ram: '8GB', cost: 209900, sell: 221000 },
    { model: 'Spark 40 Pro', storage: '256GB', ram: '8GB', cost: 231500, sell: 243700 },
    { model: 'Spark 40 Pro+', storage: '256GB', ram: '8GB', cost: 259600, sell: 273300 },
    { model: 'Spark 30 Pro', storage: '128GB', ram: '8GB', cost: 218300, sell: 231100 },
    { model: 'Spark 30 Pro', storage: '256GB', ram: '8GB', cost: 250700, sell: 265300 },
    // Phantom Foldables
    { model: 'Phantom V Flip 2', storage: '256GB', ram: '8GB', cost: 925900, sell: 979800 },
    { model: 'Phantom V Fold 2', storage: '512GB', ram: '12GB', cost: 1581700, sell: 1673800 },
    // Tablet
    { model: 'Megapad 10', storage: '128GB', ram: '4GB', cost: 206300, sell: 218400 },
    // Camon Series
    { model: 'Camon 40', storage: '128GB', ram: '8GB', cost: 273800, sell: 288800 },
    { model: 'Camon 40', storage: '256GB', ram: '8GB', cost: 308200, sell: 324500 },
    { model: 'Camon 40 Pro', storage: '256GB', ram: '8GB', cost: 351400, sell: 369700 },
];

// ------------------------------------------------------------------
// 3. DESCRIPTION GENERATOR (Full EAV + BNPL)
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

    let description = `
## Tecno ${model} Price in Nigeria

The **${fullName}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;

    if (specs.type === 'foldable') {
        description += `Experience premium foldable innovation with the **${specs.display}** and **${specs.processor}** processor.`;
    } else if (specs.type === 'tablet') {
        description += `A versatile tablet featuring **${specs.display}** display for work and entertainment.`;
    } else {
        description += `Powered by **${specs.processor}** with a stunning **${specs.display}**, this device delivers excellent value.`;
    }

    description += ` Brand new with official warranty.

## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | Tecno ${model} |
| **Price** | ${priceStr} |`;

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
- ✅ **Guaranteed Quality:** Brand New (Sealed) with Official Tecno Warranty
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Samsung Galaxy A56](/ogabassey/samsung) - Samsung Alternative
- [Infinix Hot 50 Pro](/ogabassey/infinix) - Infinix Alternative
- [iPhone 15](/ogabassey/apple) - Premium Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedTecnoProducts() {
    console.log("📱 Starting Tecno Import with Full EAV Specs...\n");

    // A. Get Parent Category
    const { data: smartphonesCategory } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'smartphones').single();
    if (!smartphonesCategory) {
        console.error("❌ 'Smartphones' category not found.");
        return;
    }
    const merchantId = smartphonesCategory.merchant_id;

    // B. Create/Get Tecno Category
    let { data: tecnoCat } = await supabase.from('categories').select('id').eq('slug', 'tecno').maybeSingle();
    if (!tecnoCat) {
        console.log("✨ Creating 'Tecno' category with SEO fields...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Tecno',
            slug: 'tecno',
            parent_id: smartphonesCategory.id,
            merchant_id: merchantId,
            description: 'Shop Tecno phones in Nigeria. Discover Phantom foldables, Camon camera phones, Spark mid-range, and Pop budget phones.',
            seo_heading: 'Buy Tecno Phones in Nigeria - Phantom, Camon, Spark & Pop',
            seo_description: 'Shop Tecno phones at best prices in Nigeria. Discover Phantom V Fold 2 foldable, Camon 40 Pro camera phone, Spark 40 Pro+ mid-range, and Pop 10 budget phones. Brand new with warranty.',
            seo_features: ['Official Tecno Warranty', 'BNPL Available', 'Same-Day Lagos Delivery', 'HiOS 15 with AI'],
            seo_faq: [
                { question: "What is the price of Tecno Camon 40 Pro in Nigeria?", answer: "The Tecno Camon 40 Pro 256GB price is ₦369,700 at Ogabassey with official warranty." },
                { question: "Is Tecno Phantom V Fold 2 available in Nigeria?", answer: "Yes! The Tecno Phantom V Fold 2 512GB is available for ₦1,673,800 with full warranty at Ogabassey." },
                { question: "Which is better, Tecno or Infinix?", answer: "Both are from Transsion. Tecno focuses on premium designs and camera, while Infinix offers value. Tecno Camon and Phantom are premium, Infinix Hot is budget-friendly." }
            ]
        }).select().single();
        tecnoCat = newCat;
        console.log("✅ Created Tecno category\n");
    }
    const categoryId = tecnoCat?.id;

    // C. Seed Products
    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} Tecno products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = TECNO_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs for ${p.model}, skipping.`);
            continue;
        }

        // Build full name
        const fullName = `Tecno ${p.model} ${p.ram} ${p.storage} (New)`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            skipped++;
            continue;
        }

        const metadata: any = {
            brand: 'Tecno',
            model: p.model,
            ram: p.ram,
            storage: p.storage,
            condition: 'New',
        };

        const description = generateDescription(p.model, fullName, p.sell, specs, metadata);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      Cost: ₦${p.cost.toLocaleString()} | Sell: ₦${p.sell.toLocaleString()}`);

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.sell,
            cost_price: p.cost,
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Tecno',
            status: 'active',
            stock: 10,
            condition: 'new'  // ALL NEW CONDITION
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

    console.log(`\n🏁 Tecno Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedTecnoProducts();
