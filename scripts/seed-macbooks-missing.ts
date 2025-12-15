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
// SPECS FOR MISSED MACBOOKS (2019-2025)
// ------------------------------------------------------------------
const MACBOOK_SPECS: Record<string, any> = {
    // === 16" MacBook Pro 2019 (Intel) ===
    'MacBook Pro 2019 Intel 16"': {
        display: '16" Retina (3072x1920)',
        processor: 'Intel Core i7/i9 (9th Gen)',
        battery: 'Up to 11 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['16" Display', 'Touch Bar', 'T2 Security Chip'],
        releaseYear: 2019
    },

    // === 13" MacBook Pro 2020 Intel ===
    'MacBook Pro 2020 Intel 13"': {
        display: '13.3" Retina (2560x1600)',
        processor: 'Intel Core i5/i7 (10th Gen)',
        battery: 'Up to 10 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', 'Magic Keyboard', 'T2 Security Chip'],
        releaseYear: 2020
    },

    // === 13" MacBook Pro 2020 M1 ===
    'MacBook Pro 2020 M1 13"': {
        display: '13.3" Retina (2560x1600)',
        processor: 'Apple M1 (8-core CPU, 8-core GPU)',
        battery: 'Up to 20 hours',
        ports: '2x Thunderbolt/USB 4, 3.5mm audio',
        features: ['Touch Bar', 'M1 Chip', '20h Battery'],
        releaseYear: 2020
    },

    // === 14"/16" MacBook Pro 2021 M1 Pro/Max ===
    'MacBook Pro 2021 M1 Pro 14"': {
        display: '14.2" Liquid Retina XDR (3024x1964, ProMotion)',
        processor: 'Apple M1 Pro (10-core CPU, 16-core GPU)',
        battery: 'Up to 17 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['ProMotion', 'XDR Display', 'Mini-LED'],
        releaseYear: 2021
    },
    'MacBook Pro 2021 M1 Max 14"': {
        display: '14.2" Liquid Retina XDR (3024x1964, ProMotion)',
        processor: 'Apple M1 Max (10-core CPU, 24/32-core GPU)',
        battery: 'Up to 17 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['ProMotion', 'XDR Display', 'Up to 64GB RAM'],
        releaseYear: 2021
    },
    'MacBook Pro 2021 M1 Pro 16"': {
        display: '16.2" Liquid Retina XDR (3456x2234, ProMotion)',
        processor: 'Apple M1 Pro (10-core CPU, 16-core GPU)',
        battery: 'Up to 21 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['ProMotion', 'XDR Display', '21h Battery'],
        releaseYear: 2021
    },
    'MacBook Pro 2021 M1 Max 16"': {
        display: '16.2" Liquid Retina XDR (3456x2234, ProMotion)',
        processor: 'Apple M1 Max (10-core CPU, 24/32-core GPU)',
        battery: 'Up to 21 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['ProMotion', 'XDR Display', 'Up to 64GB RAM'],
        releaseYear: 2021
    },

    // === 13" MacBook Pro 2022 M2 ===
    'MacBook Pro 2022 M2 13"': {
        display: '13.3" Retina (2560x1600)',
        processor: 'Apple M2 (8-core CPU, 10-core GPU)',
        battery: 'Up to 20 hours',
        ports: '2x Thunderbolt/USB 4, 3.5mm audio',
        features: ['Touch Bar', 'Active Cooling', '20h Battery'],
        releaseYear: 2022
    },

    // === 14"/16" MacBook Pro 2023 M2 Pro ===
    'MacBook Pro 2023 M2 Pro 14"': {
        display: '14.2" Liquid Retina XDR (3024x1964, ProMotion)',
        processor: 'Apple M2 Pro (10/12-core CPU, 16/19-core GPU)',
        battery: 'Up to 17 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['ProMotion', 'XDR Display', 'Wi-Fi 6E'],
        releaseYear: 2023
    },
    'MacBook Pro 2023 M2 Pro 16"': {
        display: '16.2" Liquid Retina XDR (3456x2234, ProMotion)',
        processor: 'Apple M2 Pro (12-core CPU, 19-core GPU)',
        battery: 'Up to 22 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['ProMotion', 'XDR Display', '22h Battery'],
        releaseYear: 2023
    },

    // === 14" MacBook Pro 2023 M3/M3 Pro ===
    'MacBook Pro 2023 M3 14"': {
        display: '14.2" Liquid Retina XDR (3024x1964, ProMotion)',
        processor: 'Apple M3 (8-core CPU, 10-core GPU)',
        battery: 'Up to 17 hours',
        ports: 'MagSafe 3, 2x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['3nm Chip', 'ProMotion', 'Space Black'],
        releaseYear: 2023
    },
    'MacBook Pro 2023 M3 Pro 14"': {
        display: '14.2" Liquid Retina XDR (3024x1964, ProMotion)',
        processor: 'Apple M3 Pro (11/12-core CPU, 14/18-core GPU)',
        battery: 'Up to 17 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['3nm Chip', 'ProMotion', '18/36GB RAM'],
        releaseYear: 2023
    },

    // === 14" MacBook Pro 2024/2025 M4/M4 Pro ===
    'MacBook Pro 2024 M4 14"': {
        display: '14.2" Liquid Retina XDR (3024x1964, ProMotion)',
        processor: 'Apple M4 (10-core CPU, 10-core GPU)',
        battery: 'Up to 24 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm audio',
        features: ['Apple Intelligence', '24h Battery', 'Thunderbolt 5 Ready'],
        releaseYear: 2024
    },
    'MacBook Pro 2024 M4 Pro 14"': {
        display: '14.2" Liquid Retina XDR (3024x1964, ProMotion)',
        processor: 'Apple M4 Pro (12/14-core CPU, 16/20-core GPU)',
        battery: 'Up to 22 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 5, HDMI, SDXC, 3.5mm audio',
        features: ['Thunderbolt 5', 'Apple Intelligence', 'ProMotion'],
        releaseYear: 2024
    },
};

// ------------------------------------------------------------------
// MISSED PRODUCTS FROM SHEET (Positions 28-29)
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // === 16" MacBook Pro 2019 Intel (Additional) ===
    { name: 'MacBook Pro 16-inch 2019 i7 32GB 512GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel 16"', ram: '32GB', storage: '512GB', price: 820000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2019 i9 16GB 512GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel 16"', ram: '16GB', storage: '512GB', price: 840000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2019 i9 16GB 1TB 8GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel 16"', ram: '16GB', storage: '1TB', price: 890000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2019 i9 32GB 512GB AMD Radeon TouchBar', specs: 'MacBook Pro 2019 Intel 16"', ram: '32GB', storage: '512GB', price: 920000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2019 i9 32GB 1TB 8GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel 16"', ram: '32GB', storage: '1TB', price: 1070000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2019 i9 64GB 2TB 8GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel 16"', ram: '64GB', storage: '2TB', price: 1200000, condition: 'Premium Used' },

    // === 13" MacBook Pro 2020 Intel ===
    { name: 'MacBook Pro 13-inch 2020 i5 8GB 256GB TouchBar', specs: 'MacBook Pro 2020 Intel 13"', ram: '8GB', storage: '256GB', price: 680000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 i5 8GB 512GB TouchBar', specs: 'MacBook Pro 2020 Intel 13"', ram: '8GB', storage: '512GB', price: 700000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 i5 16GB 512GB TouchBar', specs: 'MacBook Pro 2020 Intel 13"', ram: '16GB', storage: '512GB', price: 750000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 i5 16GB 1TB TouchBar', specs: 'MacBook Pro 2020 Intel 13"', ram: '16GB', storage: '1TB', price: 820000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 i7 16GB 512GB TouchBar', specs: 'MacBook Pro 2020 Intel 13"', ram: '16GB', storage: '512GB', price: 810000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 i7 32GB 512GB TouchBar', specs: 'MacBook Pro 2020 Intel 13"', ram: '32GB', storage: '512GB', price: 910000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 i7 32GB 2TB TouchBar', specs: 'MacBook Pro 2020 Intel 13"', ram: '32GB', storage: '2TB', price: 1050000, condition: 'Premium Used' },

    // === 13" MacBook Pro 2020 M1 ===
    { name: 'MacBook Pro 13-inch 2020 M1 8GB 256GB', specs: 'MacBook Pro 2020 M1 13"', ram: '8GB', storage: '256GB', price: 850000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 M1 8GB 512GB', specs: 'MacBook Pro 2020 M1 13"', ram: '8GB', storage: '512GB', price: 980000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 M1 16GB 256GB', specs: 'MacBook Pro 2020 M1 13"', ram: '16GB', storage: '256GB', price: 1000000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 M1 16GB 512GB', specs: 'MacBook Pro 2020 M1 13"', ram: '16GB', storage: '512GB', price: 1120000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2020 M1 16GB 1TB', specs: 'MacBook Pro 2020 M1 13"', ram: '16GB', storage: '1TB', price: 1250000, condition: 'Premium Used' },

    // === 14" MacBook Pro 2021 M1 Pro/Max ===
    { name: 'MacBook Pro 14-inch 2021 M1 Pro 16GB 512GB', specs: 'MacBook Pro 2021 M1 Pro 14"', ram: '16GB', storage: '512GB', price: 1500000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2021 M1 Pro 16GB 1TB', specs: 'MacBook Pro 2021 M1 Pro 14"', ram: '16GB', storage: '1TB', price: 1600000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2021 M1 Max 32GB 512GB', specs: 'MacBook Pro 2021 M1 Max 14"', ram: '32GB', storage: '512GB', price: 1850000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2021 M1 Max 64GB 1TB', specs: 'MacBook Pro 2021 M1 Max 14"', ram: '64GB', storage: '1TB', price: 2000000, condition: 'Premium Used' },

    // === 16" MacBook Pro 2021 M1 Pro/Max ===
    { name: 'MacBook Pro 16-inch 2021 M1 Pro 16GB 512GB', specs: 'MacBook Pro 2021 M1 Pro 16"', ram: '16GB', storage: '512GB', price: 1450000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2021 M1 Pro 16GB 1TB', specs: 'MacBook Pro 2021 M1 Pro 16"', ram: '16GB', storage: '1TB', price: 1650000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2021 M1 Max 32GB 1TB', specs: 'MacBook Pro 2021 M1 Max 16"', ram: '32GB', storage: '1TB', price: 2000000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2021 M1 Max 32GB 1TB', specs: 'MacBook Pro 2021 M1 Max 16"', ram: '32GB', storage: '1TB', price: 2070000, condition: 'Open Box' },

    // === 13" MacBook Pro 2022 M2 ===
    { name: 'MacBook Pro 13-inch 2022 M2 8GB 256GB', specs: 'MacBook Pro 2022 M2 13"', ram: '8GB', storage: '256GB', price: 1070000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2022 M2 8GB 512GB', specs: 'MacBook Pro 2022 M2 13"', ram: '8GB', storage: '512GB', price: 1250000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2022 M2 16GB 256GB', specs: 'MacBook Pro 2022 M2 13"', ram: '16GB', storage: '256GB', price: 1150000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2022 M2 16GB 512GB', specs: 'MacBook Pro 2022 M2 13"', ram: '16GB', storage: '512GB', price: 1350000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2022 M2 16GB 1TB', specs: 'MacBook Pro 2022 M2 13"', ram: '16GB', storage: '1TB', price: 1600000, condition: 'Premium Used' },

    // === 14"/16" MacBook Pro 2023 M2 Pro ===
    { name: 'MacBook Pro 14-inch 2023 M2 Pro 16GB 512GB', specs: 'MacBook Pro 2023 M2 Pro 14"', ram: '16GB', storage: '512GB', price: 1650000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2023 M2 Pro 16GB 1TB', specs: 'MacBook Pro 2023 M2 Pro 14"', ram: '16GB', storage: '1TB', price: 1900000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2023 M2 Pro 16GB 512GB', specs: 'MacBook Pro 2023 M2 Pro 16"', ram: '16GB', storage: '512GB', price: 1800000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2023 M2 Pro 16GB 1TB', specs: 'MacBook Pro 2023 M2 Pro 16"', ram: '16GB', storage: '1TB', price: 2000000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2023 M2 Pro 32GB 1TB', specs: 'MacBook Pro 2023 M2 Pro 16"', ram: '32GB', storage: '1TB', price: 2200000, condition: 'Premium Used' },

    // === 14" MacBook Pro 2023 M3/M3 Pro ===
    { name: 'MacBook Pro 14-inch 2023 M3 8GB 512GB', specs: 'MacBook Pro 2023 M3 14"', ram: '8GB', storage: '512GB', price: 1600000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2023 M3 16GB 512GB', specs: 'MacBook Pro 2023 M3 14"', ram: '16GB', storage: '512GB', price: 1650000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2023 M3 Pro 18GB 512GB', specs: 'MacBook Pro 2023 M3 Pro 14"', ram: '18GB', storage: '512GB', price: 1900000, condition: 'Premium Used' },

    // === 14" MacBook Pro 2024/2025 M4/M4 Pro ===
    { name: 'MacBook Pro 14-inch 2024 M4 16GB 512GB', specs: 'MacBook Pro 2024 M4 14"', ram: '16GB', storage: '512GB', price: 1950000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2024 M4 16GB 1TB', specs: 'MacBook Pro 2024 M4 14"', ram: '16GB', storage: '1TB', price: 2250000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2024 M4 Pro 16GB 512GB', specs: 'MacBook Pro 2024 M4 Pro 14"', ram: '16GB', storage: '512GB', price: 1800000, condition: 'Premium Used' },
    { name: 'MacBook Pro 14-inch 2024 M4 Pro 24GB 512GB', specs: 'MacBook Pro 2024 M4 Pro 14"', ram: '24GB', storage: '512GB', price: 2100000, condition: 'Premium Used' },
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

    // Condition explanation
    if (product.condition === 'Premium Used') {
        description += `\n\n## Condition: Premium Used (Grade A)\n\n`;
        description += `This device has been professionally inspected and verified:\n`;
        description += `- ✅ **Tested & Certified:** Full hardware diagnostics passed\n`;
        description += `- ✅ **90%+ Condition:** Minor cosmetic wear only\n`;
        description += `- ✅ **Clean Install:** Fresh macOS installation\n`;
        description += `- ✅ **Battery Health:** 80%+ capacity verified\n`;
    } else if (product.condition === 'Open Box') {
        description += `\n\n## Condition: Open Box (Grade A+)\n\n`;
        description += `This device is in **factory-fresh condition**:\n`;
        description += `- ✅ **Never Used:** Device opened for inspection only\n`;
        description += `- ✅ **Full Accessories:** All original items included\n`;
        description += `- ✅ **Full Warranty:** Manufacturer warranty applies\n`;
    }

    description += `\n\n## Key Specifications

| Spec | Value |
|------|-------|
| **Model** | ${product.name} |
| **Price** | ${priceStr} |
| **Condition** | ${product.condition} |
| **RAM** | ${product.ram} |
| **Storage** | ${product.storage} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **Battery** | ${specs.battery} |
| **Ports** | ${specs.ports} |

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR **₦${monthlyPayment.toLocaleString()}/month × 10** (BNPL)
- ✅ **Guaranteed Quality:** Verified & Tested
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Warranty:** 90-day warranty & 7-day return policy
`;

    return description.trim();
}

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedMissingMacBooks() {
    console.log("💻 Seeding Missing MacBooks (Apple Silicon)...\n");

    // Get MacBook category
    const { data: macbookCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'macbook').single();
    if (!macbookCat) {
        console.error("❌ 'MacBook' category not found.");
        return;
    }
    const merchantId = macbookCat.merchant_id;
    const categoryId = macbookCat.id;

    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} additional MacBook products...\n`);

    let created = 0;
    let skipped = 0;

    for (const p of PRODUCTS_TO_SEED) {
        const specs = MACBOOK_SPECS[p.specs];
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
            ram: p.ram,
            storage: p.storage,
            condition: p.condition,
            releaseYear: specs.releaseYear,
        };

        const description = generateDescription(p, specs);

        console.log(`   ✨ Creating: ${fullName}`);
        console.log(`      ${p.ram} | ${p.storage} | ₦${p.price.toLocaleString()}`);

        // Map condition
        const dbCondition = p.condition === 'Open Box' ? 'used' : 'used';

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.80),
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Laptops',
            status: 'active',
            stock: 2,
            condition: dbCondition,
            condition_detail: p.condition
        }).select().single();

        if (error) {
            console.error(`   ❌ Failed: ${fullName}`, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            console.log(`   ✅ Created & Linked to MacBook`);
            created++;
        }
    }

    console.log(`\n🏁 Missing MacBooks Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedMissingMacBooks().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
