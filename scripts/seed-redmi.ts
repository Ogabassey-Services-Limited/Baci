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
// 1. REDMI_SPECS: Full EAV Data (Researched 2024/2025)
// ------------------------------------------------------------------
const REDMI_SPECS: Record<string, {
    display: string;
    processor: string;
    camera: string;
    battery: string;
    os: string;
    colors: string[];
    features: string[];
    type: 'phone' | 'tablet';
}> = {
    // === A-SERIES (Budget) ===
    'A3x': {
        display: '6.71" HD+ IPS LCD (90Hz, 500 nits)',
        processor: 'Unisoc T603 Octa-core',
        camera: '8MP AI Rear | 5MP Front',
        battery: '5000mAh, 10W Charging',
        os: 'Android 14 (MIUI 14)',
        colors: ['Midnight Black', 'Lake Blue', 'Olive Green'],
        features: ['Gorilla Glass 3', 'Side Fingerprint', 'Dual SIM'],
        type: 'phone'
    },
    'A5': {
        display: '6.71" HD+ IPS LCD (90Hz)',
        processor: 'Unisoc T603 Octa-core',
        camera: '13MP AI Rear | 5MP Front',
        battery: '5000mAh, 10W Charging',
        os: 'Android 14 (MIUI 14)',
        colors: ['Black', 'Blue', 'Green'],
        features: ['Side Fingerprint', 'Dual SIM', 'Face Unlock'],
        type: 'phone'
    },
    'A3 pro': {
        display: '6.71" HD+ IPS LCD (90Hz)',
        processor: 'MediaTek Helio G81',
        camera: '13MP AI Rear | 5MP Front',
        battery: '5000mAh, 18W Fast Charging',
        os: 'Android 14 (MIUI 14)',
        colors: ['Midnight Black', 'Aurora Green', 'Sky Blue'],
        features: ['Side Fingerprint', 'Dual SIM', '18W Fast Charging'],
        type: 'phone'
    },

    // === REDMI 15 SERIES (Mid-Range 2025) ===
    '15': {
        display: '6.78" FHD+ AMOLED (120Hz)',
        processor: 'MediaTek Dimensity 6300',
        camera: '108MP AI (OIS) + 2MP | 16MP Front',
        battery: '5200mAh, 33W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Midnight Black', 'Glacier White', 'Sky Blue'],
        features: ['108MP Camera', 'AMOLED Display', '33W Charging'],
        type: 'phone'
    },
    '15T': {
        display: '6.83" 1.5K AMOLED (120Hz, HDR10+)',
        processor: 'MediaTek Dimensity 8400 Ultra (4nm)',
        camera: '50MP + 50MP 2x Tele + 12MP UW | 32MP Front',
        battery: '5500mAh, 67W Fast Charging',
        os: 'Android 15 (HyperOS 2)',
        colors: ['Black', 'Blue', 'Green'],
        features: ['Flagship Chip', 'IP68', '67W Turbo', 'Dolby Vision'],
        type: 'phone'
    },
    '15C': {
        display: '6.71" HD+ IPS LCD (90Hz)',
        processor: 'MediaTek Helio G99',
        camera: '50MP AI + 2MP | 8MP Front',
        battery: '5160mAh, 18W Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Midnight Black', 'Slate Grey', 'Lavender'],
        features: ['50MP Camera', 'Side Fingerprint', 'Dual SIM'],
        type: 'phone'
    },
    '14T': {
        display: '6.83" 1.5K AMOLED (120Hz)',
        processor: 'MediaTek Dimensity 8200 Ultra (4nm)',
        camera: '50MP + 50MP Tele + 12MP UW | 32MP Front',
        battery: '5500mAh, 67W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Titan Blue', 'Titan Black', 'Titan Grey'],
        features: ['Flagship Chip', 'IP68', '67W Turbo'],
        type: 'phone'
    },

    // === NOTE 14 SERIES (Camera-Focused) ===
    'Note14': {
        display: '6.67" FHD+ AMOLED (120Hz)',
        processor: 'MediaTek Helio G99 Ultra',
        camera: '108MP AI (OIS) + 2MP | 16MP Front',
        battery: '5110mAh, 33W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Midnight Black', 'Mist Blue', 'Ocean Teal'],
        features: ['108MP Camera', 'AMOLED', 'OIS', 'Stereo Speakers'],
        type: 'phone'
    },
    'Note14Pro': {
        display: '6.67" 1.5K AMOLED (120Hz, 3000 nits)',
        processor: 'MediaTek Dimensity 7300 Ultra (4nm)',
        camera: '200MP (OIS) + 8MP UW + 2MP | 20MP Front',
        battery: '5110mAh, 45W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Phantom Purple', 'Midnight Black', 'Ice Blue'],
        features: ['200MP Camera', 'IP68', 'Gorilla Glass Victus 2', 'NFC'],
        type: 'phone'
    },
    'Note14Pro 5G': {
        display: '6.67" 1.5K AMOLED (120Hz, 3000 nits)',
        processor: 'MediaTek Dimensity 7300 Ultra (4nm)',
        camera: '200MP (OIS) + 8MP UW + 2MP | 20MP Front',
        battery: '5110mAh, 45W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Phantom Purple', 'Midnight Black', 'Ice Blue'],
        features: ['200MP Camera', '5G', 'IP68', 'Gorilla Glass Victus 2'],
        type: 'phone'
    },

    // === PAD SERIES (Tablets) ===
    'Pad SE': {
        display: '11.0" FHD+ IPS LCD (90Hz)',
        processor: 'Qualcomm Snapdragon 680',
        camera: '8MP Rear | 5MP Front',
        battery: '8000mAh, 18W Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Graphite Grey', 'Lavender Purple', 'Mint Green'],
        features: ['Stereo Speakers', 'Eye Protection', 'SD Card Slot'],
        type: 'tablet'
    },
    'Pad SE 8.7': {
        display: '8.7" HD+ IPS LCD (90Hz, 600 nits)',
        processor: 'MediaTek Helio G85',
        camera: '8MP Rear | 5MP Front',
        battery: '6650mAh, 18W Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Graphite Grey', 'Sky Blue'],
        features: ['Compact 8.7"', 'Eye Protection', 'SD Card (2TB)'],
        type: 'tablet'
    },
    'Pad pro': {
        display: '12.1" 2.5K IPS LCD (120Hz, 600 nits)',
        processor: 'Qualcomm Snapdragon 7s Gen 2',
        camera: '8MP Rear | 8MP Front',
        battery: '10000mAh, 33W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Graphite Grey', 'Ocean Blue'],
        features: ['Gorilla Glass 3', '2.5K Display', 'Quad Speakers'],
        type: 'tablet'
    },
    'Pad Pro 5G': {
        display: '12.1" 2.5K IPS LCD (120Hz)',
        processor: 'Qualcomm Snapdragon 7s Gen 2',
        camera: '8MP Rear | 8MP Front',
        battery: '10000mAh, 33W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Graphite Grey', 'Ocean Blue'],
        features: ['5G Connectivity', '2.5K Display', 'Gorilla Glass 3'],
        type: 'tablet'
    },
    'Pad 2': {
        display: '11.0" 2.5K IPS LCD (90Hz, 600 nits)',
        processor: 'MediaTek Helio G100 Ultra',
        camera: '8MP Rear | 5MP Front',
        battery: '9000mAh, 18W Charging',
        os: 'Android 15 (HyperOS 2)',
        colors: ['Graphite Grey', 'Ocean Blue', 'Mint Green'],
        features: ['10-bit Display', 'Eye Protection', 'SD Card (2TB)'],
        type: 'tablet'
    },
    'Pad 2 Pro': {
        display: '12.1" 2.5K IPS LCD (120Hz)',
        processor: 'Qualcomm Snapdragon 7s Gen 2',
        camera: '8MP Rear | 8MP Front',
        battery: '10000mAh, 33W Fast Charging',
        os: 'Android 14 (HyperOS)',
        colors: ['Graphite Grey', 'Ocean Blue'],
        features: ['2.5K 120Hz', 'Quad Speakers', 'Dolby Atmos'],
        type: 'tablet'
    },
};

// ------------------------------------------------------------------
// 2. PRODUCTS TO SEED (from user's price list images)
// RDP = cost_price, RRP = sell price
// ALL NEW CONDITION
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // === A-Series (Budget Phones) ===
    { model: 'A3x', ram: '3GB', storage: '64GB', cost: 84400, sell: 87900 },
    { model: 'A3x', ram: '4GB', storage: '128GB', cost: 95900, sell: 99900 },
    { model: 'A5', ram: '3GB', storage: '64GB', cost: 91200, sell: 94700 },
    { model: 'A5', ram: '4GB', storage: '128GB', cost: 104200, sell: 108200 },
    { model: 'A3 pro', ram: '4GB', storage: '128GB', cost: 112800, sell: 116800 },

    // === Redmi 15 Series ===
    { model: '15', ram: '6GB', storage: '128GB', cost: 177080, sell: 186400 },
    { model: '15', ram: '8GB', storage: '256GB', cost: 202255, sell: 212900 },
    { model: '15T', ram: '12GB', storage: '512GB', cost: 680010, sell: 715800 },
    { model: '15C', ram: '4GB', storage: '128GB', cost: 126319, sell: 130900 },
    { model: '15C', ram: '6GB', storage: '128GB', cost: 138864, sell: 143900 },
    { model: '15C', ram: '8GB', storage: '256GB', cost: 162989, sell: 168900 },
    { model: '14T', ram: '12GB', storage: '512GB', cost: 659110, sell: 693800 },

    // === Note 14 Series ===
    { model: 'Note14', ram: '6GB', storage: '128GB', cost: 218310, sell: 229800 },
    { model: 'Note14', ram: '8GB', storage: '128GB', cost: 235410, sell: 247800 },
    { model: 'Note14', ram: '8GB', storage: '256GB', cost: 251560, sell: 264700 },
    { model: 'Note14Pro', ram: '8GB', storage: '256GB', cost: 351310, sell: 369800 },
    { model: 'Note14Pro', ram: '12GB', storage: '512GB', cost: 419710, sell: 441800 },
    { model: 'Note14Pro 5G', ram: '8GB', storage: '256GB', cost: 549860, sell: 578800 },
    { model: 'Note14Pro 5G', ram: '12GB', storage: '512GB', cost: 621110, sell: 653800 },

    // === Pad SE 8.7 (Compact Tablet) ===
    { model: 'Pad SE 8.7', ram: '4GB', storage: '64GB', cost: 103360, sell: 108800 },
    { model: 'Pad SE 8.7', ram: '4GB', storage: '128GB', cost: 122360, sell: 128800 },
    { model: 'Pad SE 8.7', ram: '6GB', storage: '128GB', cost: 142310, sell: 149800 },
    { model: 'Pad SE 8.7', ram: '4GB', storage: '64GB', cost: 129010, sell: 135800, note: '4G' },
    { model: 'Pad SE 8.7', ram: '4GB', storage: '128GB', cost: 147060, sell: 154800, note: '4G' },
    { model: 'Pad SE 8.7', ram: '6GB', storage: '128GB', cost: 167960, sell: 176800, note: '4G' },

    // === Pad SE (11") ===
    { model: 'Pad SE', ram: '4GB', storage: '128GB', cost: 182210, sell: 191800 },
    { model: 'Pad SE', ram: '8GB', storage: '256GB', cost: 221160, sell: 232800 },

    // === Pad Pro ===
    { model: 'Pad pro', ram: '6GB', storage: '128GB', cost: 306660, sell: 322800 },
    { model: 'Pad pro', ram: '8GB', storage: '256GB', cost: 363660, sell: 382800 },
    { model: 'Pad Pro 5G', ram: '6GB', storage: '128GB', cost: 380760, sell: 400800 },
    { model: 'Pad Pro 5G', ram: '8GB', storage: '256GB', cost: 442510, sell: 465800 },

    // === Pad 2 ===
    { model: 'Pad 2', ram: '4GB', storage: '128GB', cost: 201210, sell: 211800 },
    { model: 'Pad 2', ram: '8GB', storage: '256GB', cost: 240160, sell: 252800 },
    { model: 'Pad 2', ram: '4GB', storage: '128GB', cost: 211660, sell: 222800, note: 'Pouch' },
    { model: 'Pad 2', ram: '8GB', storage: '256GB', cost: 250610, sell: 263800, note: 'Pouch' },
    { model: 'Pad 2', ram: '4GB', storage: '128GB', cost: 240160, sell: 252800, note: '4G' },
    { model: 'Pad 2', ram: '8GB', storage: '256GB', cost: 279110, sell: 293800, note: '4G' },

    // === Pad 2 Pro (from image 1) ===
    { model: 'Pad 2 Pro', ram: '6GB', storage: '128GB', cost: 335160, sell: 352800 },
    { model: 'Pad 2 Pro', ram: '8GB', storage: '256GB', cost: 392160, sell: 412800 },
    { model: 'Pad 2 Pro', ram: '8GB', storage: '256GB', cost: 412110, sell: 433800, note: 'Pouch' },
    { model: 'Pad 2 Pro', ram: '6GB', storage: '128GB', cost: 433010, sell: 455800, note: '5G' },
    { model: 'Pad 2 Pro', ram: '8GB', storage: '256GB', cost: 497610, sell: 523800, note: '5G' },
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
## Redmi ${model} Price in Nigeria

The **${fullName}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;

    if (specs.type === 'tablet') {
        description += `Featuring a stunning **${specs.display}** and **${specs.processor}** processor for work and entertainment.`;
    } else {
        description += `Powered by **${specs.processor}** with a stunning **${specs.display}**, this device delivers excellent value with Xiaomi quality.`;
    }

    description += ` Brand new with official warranty.

## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | Redmi ${model} |
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
- ✅ **Guaranteed Quality:** Brand New (Sealed) with Official Xiaomi Warranty
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Samsung Galaxy Tab S11](/ogabassey/samsung) - Samsung Alternative
- [Tecno Megapad 10](/ogabassey/tecno) - Tecno Alternative
- [iPhone 16](/ogabassey/apple) - Apple Alternative
`;

    return description.trim();
}

// ------------------------------------------------------------------
// 4. MAIN SCRIPT
// ------------------------------------------------------------------
async function seedRedmiProducts() {
    console.log("📱 Starting Redmi Import with Full EAV Specs...\n");

    // A. Get Parent Category
    const { data: smartphonesCategory } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'smartphones').single();
    if (!smartphonesCategory) {
        console.error("❌ 'Smartphones' category not found.");
        return;
    }
    const merchantId = smartphonesCategory.merchant_id;

    // B. Create/Get Redmi Category
    let { data: redmiCat } = await supabase.from('categories').select('id').eq('slug', 'redmi').maybeSingle();
    if (!redmiCat) {
        console.log("✨ Creating 'Redmi' category with SEO fields...");
        const { data: newCat } = await supabase.from('categories').insert({
            name: 'Redmi',
            slug: 'redmi',
            parent_id: smartphonesCategory.id,
            merchant_id: merchantId,
            description: 'Shop Redmi phones and tablets in Nigeria. Discover Note 14 Pro camera phones, Redmi 15T flagships, and Redmi Pad tablets at the best prices.',
            seo_heading: 'Buy Redmi Phones & Tablets in Nigeria - Note 14 Pro, Redmi 15T, Pad Pro',
            seo_description: 'Shop Redmi phones and tablets at best prices in Nigeria. Discover Redmi Note 14 Pro 5G with 200MP camera, Redmi 15T flagship, and Redmi Pad Pro tablets. Brand new with Xiaomi warranty.',
            seo_features: ['Official Xiaomi Warranty', 'BNPL Available', 'Same-Day Lagos Delivery', 'HyperOS with AI'],
            seo_faq: [
                { question: "What is the price of Redmi Note 14 Pro 5G in Nigeria?", answer: "The Redmi Note 14 Pro 5G price starts from ₦578,800 for the 8GB/256GB variant at Ogabassey." },
                { question: "Is Redmi Pad Pro 5G available in Nigeria?", answer: "Yes! The Redmi Pad Pro 5G 8GB/256GB is available for ₦465,800 with full Xiaomi warranty at Ogabassey." },
                { question: "What camera does Redmi Note 14 Pro have?", answer: "The Redmi Note 14 Pro features an impressive 200MP main camera with OIS, 8MP ultrawide, and 2MP macro lens." }
            ]
        }).select().single();
        redmiCat = newCat;
        console.log("✅ Created Redmi category\n");
    }
    const categoryId = redmiCat?.id;

    // C. Seed Products
    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} Redmi products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = REDMI_SPECS[p.model];
        if (!specs) {
            console.warn(`⚠️ No specs for ${p.model}, using fallback.`);
            continue;
        }

        // Build full name
        let fullName = `Redmi ${p.model} ${p.ram} ${p.storage}`;
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
            brand: 'Xiaomi',
            model: `Redmi ${p.model}`,
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
            category: 'Redmi',
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

    console.log(`\n🏁 Redmi Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedRedmiProducts().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
