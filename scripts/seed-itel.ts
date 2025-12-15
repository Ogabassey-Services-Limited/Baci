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
// 1. ITEL_SPECS: Full EAV Data (Researched 2024/2025)
// itel is Transsion's budget brand - focuses on value, battery, basics
// ------------------------------------------------------------------
const ITEL_SPECS: Record<string, {
    display: string;
    processor: string;
    camera: string;
    battery: string;
    os: string;
    colors: string[];
    features: string[];
    type: 'phone';
}> = {
    // === PLAY SERIES (Entry-Level) ===
    'play10': {
        display: '6.6" HD+ IPS LCD (60Hz)',
        processor: 'Unisoc SC9832E Quad-core',
        camera: '8MP AI Rear | 5MP Front',
        battery: '5000mAh, 10W Charging',
        os: 'Android 13 (Go Edition)',
        colors: ['Force Black', 'Ocean Blue', 'Dream White'],
        features: ['Dual SIM', 'Face Unlock', 'FM Radio', 'Triple Slot'],
        type: 'phone'
    },

    // === X-SERIES (Budget Smartphones) ===
    'X5B': {
        display: '6.56" HD+ IPS LCD (60Hz)',
        processor: 'Unisoc SC9863A Octa-core',
        camera: '13MP AI Rear | 5MP Front',
        battery: '5000mAh, 10W Charging',
        os: 'Android 13 (itelOS 13)',
        colors: ['Force Black', 'Ocean Blue', 'Glacier White'],
        features: ['Dual SIM', 'Face Unlock', 'Side Fingerprint'],
        type: 'phone'
    },
    'X5bPlus': {
        display: '6.6" HD+ IPS LCD (60Hz)',
        processor: 'Unisoc T603 Octa-core',
        camera: '13MP AI Rear | 5MP Front',
        battery: '5000mAh, 18W Fast Charging',
        os: 'Android 13 (itelOS 13)',
        colors: ['Galaxy Black', 'Aurora Blue', 'Pearl White'],
        features: ['Dual SIM', 'Face Unlock', 'Side Fingerprint', '18W Charging'],
        type: 'phone'
    },
    'X6c': {
        display: '6.6" HD+ IPS LCD (90Hz)',
        processor: 'MediaTek Helio G37 Octa-core',
        camera: '50MP AI Rear + 2MP Depth | 8MP Front',
        battery: '5000mAh, 18W Fast Charging',
        os: 'Android 14 (itelOS 14)',
        colors: ['Starry Black', 'Dreamy Blue', 'Elegant Gold'],
        features: ['90Hz Display', '50MP Camera', 'Side Fingerprint', 'Face Unlock'],
        type: 'phone'
    },
    'X7c': {
        display: '6.78" FHD+ AMOLED (90Hz)',
        processor: 'MediaTek Helio G85 Octa-core',
        camera: '50MP AI (OIS) + 2MP | 8MP Front',
        battery: '5000mAh, 33W Fast Charging',
        os: 'Android 14 (itelOS 14)',
        colors: ['Starry Black', 'Aurora Blue', 'Pearl White'],
        features: ['AMOLED Display', 'OIS Camera', '33W Fast Charging', 'NFC'],
        type: 'phone'
    },
    'X8c': {
        display: '6.78" FHD+ AMOLED (120Hz)',
        processor: 'MediaTek Helio G99 Octa-core',
        camera: '108MP AI (OIS) + 2MP Depth | 16MP Front',
        battery: '5000mAh, 45W Fast Charging',
        os: 'Android 14 (itelOS 14)',
        colors: ['Midnight Black', 'Ocean Blue', 'Aurora White'],
        features: ['120Hz AMOLED', '108MP Camera', '45W Charging', 'NFC', 'Stereo Speakers'],
        type: 'phone'
    },
    'X9c': {
        display: '6.78" FHD+ AMOLED (120Hz, 1200 nits)',
        processor: 'MediaTek Dimensity 6100+ (6nm)',
        camera: '108MP AI (OIS) + 8MP UW + 2MP | 32MP Front',
        battery: '5500mAh, 45W Fast Charging',
        os: 'Android 14 (itelOS 14)',
        colors: ['Starry Black', 'Aurora Blue', 'Glacier White'],
        features: ['5G Connectivity', '108MP Triple Camera', '45W Charging', 'NFC', 'IP54'],
        type: 'phone'
    },
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from user's price list image)
// RDP = cost_price, RRP = sell price
// ALL NEW CONDITION
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    { model: 'play10', ram: '3GB', storage: '64GB', cost: 0, sell: 85000 }, // RDP not visible
    { model: 'X5B', ram: '4GB', storage: '64GB', cost: 103700, sell: 109900 },
    { model: 'X5bPlus', ram: '4GB', storage: '128GB', cost: 113100, sell: 119900 },
    { model: 'X6c', ram: '6GB', storage: '128GB', cost: 134800, sell: 142900 },
    { model: 'X6c', ram: '6GB', storage: '256GB', cost: 150400, sell: 159500 },
    { model: 'X7c', ram: '8GB', storage: '256GB', cost: 245000, sell: 259700 },
    { model: 'X8c', ram: '8GB', storage: '512GB', cost: 328800, sell: 348600 },
    { model: 'X9c', ram: '8GB', storage: '256GB', cost: 441700, sell: 468500 },
    { model: 'X9c', ram: '12GB', storage: '256GB', cost: 518300, sell: 549500 },
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
## itel ${model} Price in Nigeria

The **${fullName}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;

    description += `Powered by **${specs.processor}** with a **${specs.display}**, this device delivers excellent value and reliability. Brand new with official warranty.`;

    description += `

## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | itel ${model} |
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
- ✅ **Guaranteed Quality:** Brand New (Sealed) with Official itel Warranty
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Tecno Spark 40](/ogabassey/tecno) - Tecno Alternative
- [Infinix Hot 50](/ogabassey/infinix) - Infinix Alternative
- [Redmi A3x](/ogabassey/redmi) - Redmi Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedItelProducts() {
    console.log("📱 Starting itel Import with Full EAV Specs...\n");

    // A. Get Parent Category
    const { data: smartphonesCategory } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'smartphones').single();
    if (!smartphonesCategory) {
        console.error("❌ 'Smartphones' category not found.");
        return;
    }
    const merchantId = smartphonesCategory.merchant_id;

    // B. Create/Get itel Category
    let { data: itelCat } = await supabase.from('categories').select('id').eq('slug', 'itel').maybeSingle();
    if (!itelCat) {
        console.log("✨ Creating 'itel' category with SEO fields...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'itel',
            slug: 'itel',
            parent_id: smartphonesCategory.id,
            merchant_id: merchantId,
            description: 'Shop itel phones in Nigeria. Discover the X-series smartphones and Play budget phones at affordable prices with excellent value.',
            seo_heading: 'Buy itel Phones in Nigeria - X9c, X8c, X7c, X6c & Play',
            seo_description: 'Shop itel phones at best prices in Nigeria. Discover itel X9c with 108MP camera, X8c with 120Hz AMOLED, X7c mid-range, and budget-friendly Play series. Brand new with warranty.',
            seo_features: ['Official itel Warranty', 'BNPL Available', 'Same-Day Lagos Delivery', 'Big Battery Life'],
            seo_faq: [
                { question: "What is the price of itel X9c in Nigeria?", answer: "The itel X9c price starts from ₦468,500 for the 8GB/256GB variant at Ogabassey." },
                { question: "Is itel a good phone brand?", answer: "Yes! itel is a Transsion brand (same as Tecno & Infinix) known for reliable budget phones with great battery life and value." },
                { question: "Which itel phone has the best camera?", answer: "The itel X9c features a 108MP main camera with OIS, making it the best camera phone in the itel lineup." }
            ]
        }).select().single();
        itelCat = newCat;
        console.log("✅ Created itel category\n");
    }
    const categoryId = itelCat?.id;

    // C. Seed Products
    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} itel products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = ITEL_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs for ${p.model}, skipping.`);
            continue;
        }

        // Build full name
        const fullName = `itel ${p.model} ${p.ram} ${p.storage} (New)`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            skipped++;
            continue;
        }

        const metadata: any = {
            brand: 'itel',
            model: `itel ${p.model}`,
            ram: p.ram,
            storage: p.storage,
            condition: 'New',
        };

        const description = generateDescription(p.model, fullName, p.sell, specs, metadata);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      Cost: ₦${p.cost.toLocaleString()} | Sell: ₦${p.sell.toLocaleString()}`);

        // Use sell price if cost is 0 (not visible in image)
        const costPrice = p.cost > 0 ? p.cost : Math.round(p.sell * 0.9); // Estimate 10% margin if not provided

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.sell,
            cost_price: costPrice,
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'itel',
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

    console.log(`\n🏁 itel Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedItelProducts().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
