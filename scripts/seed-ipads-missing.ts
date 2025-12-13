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
// IPAD SPECS
// ------------------------------------------------------------------
const IPAD_SPECS: Record<string, any> = {
    'iPad Air 5th Gen 2022 M1': {
        display: '10.9" Liquid Retina IPS LCD',
        processor: 'Apple M1',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '28.6Wh, 20W Fast Charging',
        features: ['M1 Chip', 'Center Stage', '5G Optional'],
        releaseYear: 2022
    },
    'iPad Air 6th Gen 2024 M2': {
        display: '11" / 13" Liquid Retina',
        processor: 'Apple M2',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '28.93Wh / 36.59Wh, 20W Fast Charging',
        features: ['M2 Chip', 'Landscape Camera', 'Wi-Fi 6E'],
        releaseYear: 2024
    },
    'iPad Mini 6th Gen 2021': {
        display: '8.3" Liquid Retina IPS LCD',
        processor: 'A15 Bionic',
        camera: '12MP Wide | 12MP Ultra Wide FaceTime',
        battery: '19.3Wh, 20W Fast Charging',
        features: ['Compact Size', 'Touch ID', 'Apple Pencil 2'],
        releaseYear: 2021
    },
    'iPad Pro 2018 11"': {
        display: '11" Liquid Retina IPS LCD (ProMotion)',
        processor: 'A12X Bionic',
        camera: '12MP Wide | 7MP TrueDepth',
        battery: '29.37Wh, 18W Fast Charging',
        features: ['Face ID', 'ProMotion 120Hz', 'USB-C'],
        releaseYear: 2018
    },
    'iPad Pro 2021 11" M1': {
        display: '11" Liquid Retina IPS LCD (ProMotion)',
        processor: 'Apple M1',
        camera: '12MP Wide + 10MP Ultra Wide + LiDAR | 12MP TrueDepth',
        battery: '28.65Wh, 20W Fast Charging',
        features: ['M1 Chip', 'Thunderbolt', '5G'],
        releaseYear: 2021
    },
    'iPad Pro 2022 11" M2': {
        display: '11" Liquid Retina IPS LCD (ProMotion)',
        processor: 'Apple M2',
        camera: '12MP Wide + 10MP Ultra Wide + LiDAR | 12MP TrueDepth',
        battery: '28.65Wh, 20W Fast Charging',
        features: ['M2 Chip', 'Apple Pencil Hover', 'ProRes Video'],
        releaseYear: 2022
    },
    'iPad Pro 2024 11" M4': {
        display: '11" Ultra Retina XDR OLED',
        processor: 'Apple M4',
        camera: '12MP Wide + LiDAR | 12MP TrueDepth',
        battery: '31.29Wh, 20W Fast Charging',
        features: ['M4 Chip', 'Tandem OLED', 'Apple Intelligence'],
        releaseYear: 2024
    },
    'iPad Pro 2021 12.9" M1': {
        display: '12.9" Liquid Retina XDR Mini-LED (ProMotion)',
        processor: 'Apple M1',
        camera: '12MP Wide + 10MP Ultra Wide + LiDAR | 12MP TrueDepth',
        battery: '40.88Wh, 20W Fast Charging',
        features: ['M1 Chip', 'Mini-LED', 'Thunderbolt'],
        releaseYear: 2021
    },
    'iPad Pro 2022 12.9" M2': {
        display: '12.9" Liquid Retina XDR Mini-LED (ProMotion)',
        processor: 'Apple M2',
        camera: '12MP Wide + 10MP Ultra Wide + LiDAR | 12MP TrueDepth',
        battery: '40.88Wh, 20W Fast Charging',
        features: ['M2 Chip', 'Mini-LED', 'Apple Pencil Hover'],
        releaseYear: 2022
    },
    'iPad Pro 2024 13" M4': {
        display: '13" Ultra Retina XDR OLED',
        processor: 'Apple M4',
        camera: '12MP Wide + LiDAR | 12MP TrueDepth',
        battery: '38.99Wh, 20W Fast Charging',
        features: ['M4 Chip', 'Tandem OLED', 'Apple Intelligence'],
        releaseYear: 2024
    },
};

// ------------------------------------------------------------------
// PRODUCTS FROM SHEET (Positions 20-21) - Missing Used iPads
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // === iPad Air 6th Gen 2024 M2 (Used) ===
    { name: 'iPad Air 6th Gen 2024 M2 256GB 13-inch WiFi', specs: 'iPad Air 6th Gen 2024 M2', storage: '256GB', size: '13"', price: 880000, condition: 'Premium Used' },

    // === iPad Mini 6th Gen 2021 (Used) ===
    { name: 'iPad Mini 6th Gen 2021 64GB 8.3-inch WiFi', specs: 'iPad Mini 6th Gen 2021', storage: '64GB', size: '8.3"', price: 470000, condition: 'Premium Used' },
    { name: 'iPad Mini 6th Gen 2021 256GB 8.3-inch WiFi + Cellular', specs: 'iPad Mini 6th Gen 2021', storage: '256GB', size: '8.3"', price: 630000, condition: 'Premium Used' },

    // === iPad Pro 2018 11" (Used) ===
    { name: 'iPad Pro 2018 11-inch 64GB WiFi + Cellular', specs: 'iPad Pro 2018 11"', storage: '64GB', size: '11"', price: 585000, condition: 'Premium Used' },
    { name: 'iPad Pro 2018 11-inch 256GB WiFi + Cellular', specs: 'iPad Pro 2018 11"', storage: '256GB', size: '11"', price: 640000, condition: 'Premium Used' },
    { name: 'iPad Pro 2018 11-inch 512GB WiFi + Cellular', specs: 'iPad Pro 2018 11"', storage: '512GB', size: '11"', price: 690000, condition: 'Premium Used' },
    { name: 'iPad Pro 2018 11-inch 1TB WiFi + Cellular', specs: 'iPad Pro 2018 11"', storage: '1TB', size: '11"', price: 730000, condition: 'Premium Used' },

    // === iPad Pro 2021 11" M1 (Used) ===
    { name: 'iPad Pro 2021 M1 11-inch 128GB WiFi + Cellular', specs: 'iPad Pro 2021 11" M1', storage: '128GB', size: '11"', price: 930000, condition: 'Premium Used' },
    { name: 'iPad Pro 2021 M1 11-inch 256GB WiFi + Cellular', specs: 'iPad Pro 2021 11" M1', storage: '256GB', size: '11"', price: 980000, condition: 'Premium Used' },
    { name: 'iPad Pro 2021 M1 11-inch 512GB WiFi + Cellular', specs: 'iPad Pro 2021 11" M1', storage: '512GB', size: '11"', price: 1030000, condition: 'Premium Used' },

    // === iPad Pro 2022 11" M2 (Used) ===
    { name: 'iPad Pro 2022 M2 11-inch 128GB WiFi', specs: 'iPad Pro 2022 11" M2', storage: '128GB', size: '11"', price: 930000, condition: 'Premium Used' },
    { name: 'iPad Pro 2022 M2 11-inch 128GB WiFi + Cellular', specs: 'iPad Pro 2022 11" M2', storage: '128GB', size: '11"', price: 1090000, condition: 'Premium Used' },
    { name: 'iPad Pro 2022 M2 11-inch 256GB WiFi', specs: 'iPad Pro 2022 11" M2', storage: '256GB', size: '11"', price: 1100000, condition: 'Premium Used' },
    { name: 'iPad Pro 2022 M2 11-inch 256GB WiFi + Cellular', specs: 'iPad Pro 2022 11" M2', storage: '256GB', size: '11"', price: 1200000, condition: 'Premium Used' },
    { name: 'iPad Pro 2022 M2 11-inch 1TB WiFi', specs: 'iPad Pro 2022 11" M2', storage: '1TB', size: '11"', price: 1280000, condition: 'Premium Used' },

    // === iPad Pro 2024 11" M4 (Used) ===
    { name: 'iPad Pro 2024 M4 11-inch 256GB WiFi + Cellular', specs: 'iPad Pro 2024 11" M4', storage: '256GB', size: '11"', price: 1165000, condition: 'Premium Used' },

    // === iPad Pro 2021 12.9" M1 (Used) ===
    { name: 'iPad Pro 2021 M1 12.9-inch 128GB WiFi + Cellular', specs: 'iPad Pro 2021 12.9" M1', storage: '128GB', size: '12.9"', price: 900000, condition: 'Premium Used' },

    // === iPad Pro 2024 13" M4 (Used) ===
    { name: 'iPad Pro 2024 M4 13-inch 256GB WiFi', specs: 'iPad Pro 2024 13" M4', storage: '256GB', size: '13"', price: 1260000, condition: 'Premium Used' },
];

// ------------------------------------------------------------------
// DESCRIPTION GENERATOR
// ------------------------------------------------------------------
function generateDescription(product: any, specs: any) {
    const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.price);
    const monthlyPayment = Math.ceil(product.price / 10);
    const bnplStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(monthlyPayment);

    let description = `## ${product.name} Price in Nigeria\n\n`;
    description += `The **${product.name}** is available at Ogabassey for **${priceStr}**, or pay **${bnplStr}/month × 10** via BNPL. `;
    description += `Powered by the **${specs.processor}** with stunning **${specs.display}**. `;
    description += `Features include ${specs.features.slice(0, 3).join(', ')}.`;

    // Premium Used explanation
    description += `\n\n## Condition: Premium Used (Grade A)\n\n`;
    description += `This device has been professionally inspected and verified:\n`;
    description += `- ✅ **Tested & Certified:** Full hardware diagnostics passed\n`;
    description += `- ✅ **90%+ Condition:** Minor cosmetic wear only\n`;
    description += `- ✅ **Clean Install:** Fresh iPadOS installation\n`;
    description += `- ✅ **Battery Health:** 80%+ capacity verified\n`;

    description += `\n\n## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | ${product.name} |
| **Price** | ${priceStr} |
| **Condition** | ${product.condition} |
| **Storage** | ${product.storage} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **Camera** | ${specs.camera} |
| **Features** | ${specs.features.join(', ')} |

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR **₦${monthlyPayment.toLocaleString()}/month × 10** (BNPL)
- ✅ **Guaranteed Quality:** Premium Used with Full Verification
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Warranty:** 90-day warranty & 7-day return policy
`;

    return description.trim();
}

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedMissingUsedIPads() {
    console.log("📱 Seeding Missing Used iPads...\n");

    // Get Tablets category
    const { data: tabletsCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'tablets').single();
    if (!tabletsCat) {
        console.error("❌ 'Tablets' category not found.");
        return;
    }
    const merchantId = tabletsCat.merchant_id;
    const categoryId = tabletsCat.id;

    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} additional iPad products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = IPAD_SPECS[p.specs];
        if (!specs) {
            console.warn(`⚠️ No specs for ${p.specs}, skipping.`);
            continue;
        }

        const fullName = `${p.name} (${p.condition})`;
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
            model: p.name,
            storage: p.storage,
            displaySize: p.size,
            condition: p.condition,
            releaseYear: specs.releaseYear,
        };

        const description = generateDescription(p, specs);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      ${p.storage} | ${p.size} | ₦${p.price.toLocaleString()}`);

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.80),
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Tablets',
            status: 'active',
            stock: 2,
            condition: 'used',
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            console.log(`   ✅ Created & Linked to Tablets`);
            created++;
        }
    }

    console.log(`\n🏁 Missing Used iPads Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedMissingUsedIPads();
