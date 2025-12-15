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
// 1. VIVO_SPECS: Full EAV Data (Researched 2024/2025)
// ------------------------------------------------------------------
const VIVO_SPECS: Record<string, {
    display: string;
    processor: string;
    camera: string;
    battery: string;
    os: string;
    colors: string[];
    features: string[];
    type: 'phone';
}> = {
    // === Y-SERIES (Budget/Mid-Range) ===
    'Y03': {
        display: '6.56" HD+ IPS LCD (60Hz)',
        processor: 'MediaTek Helio G85',
        camera: '13MP AI Rear | 5MP Front',
        battery: '5000mAh, 15W Charging',
        os: 'Android 14 (Funtouch OS 14)',
        colors: ['Gem Green', 'Crystal Black'],
        features: ['Dual SIM', 'Face Unlock', 'Side Fingerprint'],
        type: 'phone'
    },
    'Y04': {
        display: '6.56" HD+ IPS LCD (60Hz)',
        processor: 'MediaTek Helio G85',
        camera: '13MP AI Rear | 5MP Front',
        battery: '5000mAh, 15W Charging',
        os: 'Android 14 (Funtouch OS 14)',
        colors: ['Dreamy White', 'Starry Black', 'Gleaming Gold'],
        features: ['Dual SIM', 'Face Unlock', 'Side Fingerprint', 'Ultra Game Mode'],
        type: 'phone'
    },
    'Y19s': {
        display: '6.68" FHD+ AMOLED (90Hz)',
        processor: 'MediaTek Helio G85',
        camera: '50MP AI + 2MP | 8MP Front',
        battery: '5000mAh, 33W FlashCharge',
        os: 'Android 14 (Funtouch OS 14)',
        colors: ['Midnight Black', 'Wave Blue', 'Pearl White'],
        features: ['AMOLED Display', '33W Charging', 'Side Fingerprint'],
        type: 'phone'
    },
    'Y21d': {
        display: '6.68" HD+ LCD (90Hz, 1000 nits)',
        processor: 'Unisoc T7225 Octa-core',
        camera: '50MP AI + VGA | 5MP Front',
        battery: '6500mAh, 44W FlashCharge',
        os: 'Android 15 (Funtouch OS 15)',
        colors: ['Silk Black', 'Silk Green'],
        features: ['IP68/IP69 Water Resistant', '6500mAh Big Battery', '44W Fast Charging'],
        type: 'phone'
    },
    'Y29': {
        display: '6.68" HD+ LCD (120Hz, 1000 nits)',
        processor: 'Qualcomm Snapdragon 685',
        camera: '50MP AI + 2MP | 8MP Front',
        battery: '6500mAh, 44W FlashCharge',
        os: 'Android 14 (Funtouch OS 14)',
        colors: ['Diamond Black', 'Glacier Blue', 'Titanium Gold'],
        features: ['6500mAh Big Battery', '44W Fast Charging', '120Hz Display'],
        type: 'phone'
    },

    // === V-SERIES (Flagship/Camera-Focused) ===
    'V40Lite': {
        display: '6.67" FHD+ AMOLED (120Hz, 1800 nits)',
        processor: 'Qualcomm Snapdragon 4 Gen 2',
        camera: '50MP (OIS) + 8MP UW | 32MP Front',
        battery: '5000mAh, 80W FlashCharge',
        os: 'Android 14 (Funtouch OS 14)',
        colors: ['Titanium Silver', 'Classy Brown', 'Ganges Blue'],
        features: ['AMOLED 120Hz', '80W Fast Charging', '50MP OIS Camera'],
        type: 'phone'
    },
    'V50Lite': {
        display: '6.67" FHD+ AMOLED (120Hz)',
        processor: 'Qualcomm Snapdragon 6 Gen 1',
        camera: '64MP (OIS) + 8MP UW + 2MP | 32MP Front',
        battery: '5000mAh, 80W FlashCharge',
        os: 'Android 14 (Funtouch OS 14)',
        colors: ['Titanium Silver', 'Midnight Black'],
        features: ['AMOLED Display', '64MP OIS Camera', '80W Charging'],
        type: 'phone'
    },
    'V50': {
        display: '6.77" FHD+ AMOLED (120Hz, 4500 nits)',
        processor: 'Qualcomm Snapdragon 7 Gen 3',
        camera: '50MP (OIS) + 50MP UW | 50MP Front',
        battery: '6000mAh, 90W FlashCharge',
        os: 'Android 15 (Funtouch OS 15)',
        colors: ['Titanium Grey', 'Rose Gold', 'Ocean Blue'],
        features: ['Zeiss Optics', 'AMOLED 120Hz', '90W Charging', 'IP68'],
        type: 'phone'
    },
    'V60': {
        display: '6.77" FHD+ AMOLED (120Hz, 5000 nits)',
        processor: 'Qualcomm Snapdragon 7 Gen 4',
        camera: '50MP Zeiss (OIS) + 50MP 3x Tele + 8MP UW | 50MP Front',
        battery: '6500mAh, 90W FlashCharge',
        os: 'Android 15 (Funtouch OS 15)',
        colors: ['Titanium Grey', 'Ceramic White', 'Phantom Purple'],
        features: ['Zeiss Triple Camera', '3x Optical Zoom', '90W Charging', 'IP68/IP69'],
        type: 'phone'
    },
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from user's price list image)
// RDP = cost_price, RRP = sell price
// ALL NEW CONDITION
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // Y-Series (Budget)
    { model: 'Y29', ram: '8GB', storage: '128GB', cost: 246800, sell: 259800 },
    { model: 'Y29', ram: '8GB', storage: '256GB', cost: 275300, sell: 289800 },
    { model: 'Y03', ram: '4GB', storage: '64GB', cost: 115000, sell: 119800 },
    { model: 'Y04', ram: '4GB', storage: '64GB', cost: 130400, sell: 135800 },
    { model: 'Y04', ram: '4GB', storage: '128GB', cost: 143800, sell: 149800 },
    { model: 'Y19s', ram: '6GB', storage: '128GB', cost: 190800, sell: 199800 },
    { model: 'Y21d', ram: '4GB', storage: '128GB', cost: 190800, sell: 199800 },
    { model: 'Y21d', ram: '6GB', storage: '128GB', cost: 209900, sell: 219800 },
    { model: 'Y21d', ram: '6GB', storage: '256GB', cost: 229000, sell: 239800 },
    // V-Series (Flagship)
    { model: 'V60', ram: '12GB', storage: '512GB', cost: 807300, sell: 849800 },
    { model: 'V40Lite', ram: '8GB', storage: '256GB', cost: 372300, sell: 389800 },
    { model: 'V50Lite', ram: '8GB', storage: '256GB', cost: 427300, sell: 449800 },
    { model: 'V50', ram: '12GB', storage: '512GB', cost: 759800, sell: 799800 },
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
## vivo ${model} Price in Nigeria

The **${fullName}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;

    if (model.startsWith('V')) {
        description += `Featuring premium **${specs.camera}** camera system and stunning **${specs.display}** display, this flagship delivers professional-grade photography.`;
    } else {
        description += `Powered by **${specs.processor}** with impressive **${specs.battery}** endurance, this device offers excellent value for everyday use.`;
    }

    description += ` Brand new with official warranty.

## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | vivo ${model} |
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
- ✅ **Guaranteed Quality:** Brand New (Sealed) with Official vivo Warranty
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Samsung Galaxy A56](/ogabassey/samsung) - Samsung Alternative
- [Redmi Note 14 Pro](/ogabassey/redmi) - Redmi Alternative
- [Tecno Camon 40 Pro](/ogabassey/tecno) - Tecno Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedVivoProducts() {
    console.log("📱 Starting vivo Import with Full EAV Specs...\n");

    // A. Get Parent Category
    const { data: smartphonesCategory } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'smartphones').single();
    if (!smartphonesCategory) {
        console.error("❌ 'Smartphones' category not found.");
        return;
    }
    const merchantId = smartphonesCategory.merchant_id;

    // B. Create/Get vivo Category
    let { data: vivoCat } = await supabase.from('categories').select('id').eq('slug', 'vivo').maybeSingle();
    if (!vivoCat) {
        console.log("✨ Creating 'vivo' category with SEO fields...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'vivo',
            slug: 'vivo',
            parent_id: smartphonesCategory.id,
            merchant_id: merchantId,
            description: 'Shop vivo phones in Nigeria. Discover V-series camera flagships with Zeiss optics and Y-series budget phones with massive batteries.',
            seo_heading: 'Buy vivo Phones in Nigeria - V60, V50, Y29 & More',
            seo_description: 'Shop vivo phones at best prices in Nigeria. Discover vivo V60 with Zeiss camera, V50 flagship, Y29 with 6500mAh battery, and more. Brand new with official vivo warranty.',
            seo_features: ['Official vivo Warranty', 'BNPL Available', 'Same-Day Lagos Delivery', 'Zeiss Camera Optics'],
            seo_faq: [
                { question: "What is the price of vivo V60 in Nigeria?", answer: "The vivo V60 12GB/512GB price is ₦849,800 at Ogabassey with official vivo warranty." },
                { question: "Which vivo phone has the best camera?", answer: "The vivo V60 features a triple Zeiss camera system with 50MP main sensor and 3x optical zoom for professional photography." },
                { question: "Is vivo a good phone brand?", answer: "Yes! vivo is a top-5 global smartphone brand known for innovative camera technology, big batteries, and fast charging." }
            ]
        }).select().single();
        vivoCat = newCat;
        console.log("✅ Created vivo category\n");
    }
    const categoryId = vivoCat?.id;

    // C. Seed Products
    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} vivo products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = VIVO_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs for ${p.model}, skipping.`);
            continue;
        }

        // Build full name
        const fullName = `vivo ${p.model} ${p.ram} ${p.storage} (New)`;
        const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if exists
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
        if (existing) {
            console.log(`   ⏩ Skipping existing: ${fullName}`);
            skipped++;
            continue;
        }

        const metadata: any = {
            brand: 'vivo',
            model: `vivo ${p.model}`,
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
            category: 'vivo',
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

    console.log(`\n🏁 vivo Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedVivoProducts().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
