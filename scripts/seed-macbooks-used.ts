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
// MACBOOK SPECS - Intel + Apple Silicon
// ------------------------------------------------------------------
const MACBOOK_SPECS: Record<string, any> = {
    // === Intel MacBook Air ===
    'MacBook Air 2015 Intel': {
        display: '11" or 13.3" LED-backlit (1440x900 / 1366x768)',
        processor: 'Intel Core i5/i7 (5th Gen)',
        battery: 'Up to 9-12 hours',
        ports: '2x USB 3.0, Thunderbolt 2, MagSafe 2, SD Card',
        features: ['Lightweight', 'macOS Monterey'],
        releaseYear: 2015
    },
    'MacBook Air 2017 Intel': {
        display: '13.3" LED-backlit (1440x900)',
        processor: 'Intel Core i5 (5th Gen)',
        battery: 'Up to 12 hours',
        ports: '2x USB 3.0, Thunderbolt 2, MagSafe 2, SD Card',
        features: ['Lightweight', 'macOS Monterey'],
        releaseYear: 2017
    },
    'MacBook Air 2018 Intel': {
        display: '13.3" Retina (2560x1600)',
        processor: 'Intel Core i5 (8th Gen)',
        battery: 'Up to 12 hours',
        ports: '2x Thunderbolt 3/USB-C, 3.5mm audio',
        features: ['Touch ID', 'Retina Display', 'T2 Security Chip'],
        releaseYear: 2018
    },
    'MacBook Air 2019 Intel': {
        display: '13.3" Retina (2560x1600)',
        processor: 'Intel Core i5 (8th Gen)',
        battery: 'Up to 12 hours',
        ports: '2x Thunderbolt 3/USB-C, 3.5mm audio',
        features: ['Touch ID', 'True Tone', 'T2 Security Chip'],
        releaseYear: 2019
    },
    'MacBook Air 2020 Intel': {
        display: '13.3" Retina (2560x1600)',
        processor: 'Intel Core i3/i5/i7 (10th Gen)',
        battery: 'Up to 11 hours',
        ports: '2x Thunderbolt 3/USB-C, 3.5mm audio',
        features: ['Touch ID', 'Magic Keyboard', 'T2 Security Chip'],
        releaseYear: 2020
    },

    // === Apple Silicon MacBook Air ===
    'MacBook Air 2020 M1': {
        display: '13.3" Retina (2560x1600)',
        processor: 'Apple M1 (8-core CPU, 7/8-core GPU)',
        battery: 'Up to 18 hours',
        ports: '2x Thunderbolt/USB 4, 3.5mm audio',
        features: ['Fanless Design', 'Touch ID', 'Magic Keyboard'],
        releaseYear: 2020
    },
    'MacBook Air 2022 M2': {
        display: '13.6" Liquid Retina (2560x1664)',
        processor: 'Apple M2 (8-core CPU, 8/10-core GPU)',
        battery: 'Up to 18 hours',
        ports: 'MagSafe 3, 2x Thunderbolt/USB 4, 3.5mm audio',
        features: ['Fanless Design', 'Notch Display', '1080p FaceTime'],
        releaseYear: 2022
    },
    'MacBook Air 2024 M3': {
        display: '15.3" Liquid Retina (2880x1864)',
        processor: 'Apple M3 (8-core CPU, 10-core GPU)',
        battery: 'Up to 18 hours',
        ports: 'MagSafe 3, 2x Thunderbolt/USB 4, 3.5mm audio',
        features: ['3nm Chip', 'Larger Display', 'Six-Speaker Sound'],
        releaseYear: 2024
    },
    'MacBook Air 2025 M4': {
        display: '13.6" Liquid Retina (2560x1664)',
        processor: 'Apple M4 (10-core CPU, 10-core GPU)',
        battery: 'Up to 18 hours',
        ports: 'MagSafe 3, 2x Thunderbolt 4, 3.5mm audio',
        features: ['Apple Intelligence', 'Neural Engine 16-core'],
        releaseYear: 2025
    },

    // === Intel MacBook Pro ===
    'MacBook Pro 2014 Intel': {
        display: '13" or 15" Retina',
        processor: 'Intel Core i5/i7 (4th Gen)',
        battery: 'Up to 9 hours',
        ports: '2x Thunderbolt 2, USB 3.0, HDMI, MagSafe 2, SD Card',
        features: ['Retina Display', 'Force Touch Trackpad'],
        releaseYear: 2014
    },
    'MacBook Pro 2015 Intel': {
        display: '13" or 15" Retina',
        processor: 'Intel Core i5/i7 (5th Gen)',
        battery: 'Up to 10 hours',
        ports: '2x Thunderbolt 2, USB 3.0, HDMI, MagSafe 2, SD Card',
        features: ['Retina Display', 'Force Touch Trackpad'],
        releaseYear: 2015
    },
    'MacBook Pro 2016 Intel TouchBar': {
        display: '13" or 15" Retina',
        processor: 'Intel Core i5/i7 (6th Gen)',
        battery: 'Up to 10 hours',
        ports: '2x/4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', 'Touch ID', 'Force Touch Trackpad'],
        releaseYear: 2016
    },
    'MacBook Pro 2017 Intel TouchBar': {
        display: '13" or 15" Retina',
        processor: 'Intel Core i5/i7 (7th Gen)',
        battery: 'Up to 10 hours',
        ports: '2x/4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', 'Touch ID', 'Kaby Lake'],
        releaseYear: 2017
    },
    'MacBook Pro 2017 Intel Non-TouchBar': {
        display: '13" Retina',
        processor: 'Intel Core i5/i7 (7th Gen)',
        battery: 'Up to 10 hours',
        ports: '2x Thunderbolt 3, 3.5mm audio',
        features: ['No Touch Bar', 'Function Keys', 'Kaby Lake'],
        releaseYear: 2017
    },
    'MacBook Pro 2018 Intel TouchBar': {
        display: '13" or 15" Retina (True Tone)',
        processor: 'Intel Core i5/i7/i9 (8th Gen)',
        battery: 'Up to 10 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', 'T2 Security Chip', 'True Tone'],
        releaseYear: 2018
    },
    'MacBook Pro 2019 Intel TouchBar': {
        display: '13" or 15/16" Retina (True Tone)',
        processor: 'Intel Core i5/i7/i9 (8th/9th Gen)',
        battery: 'Up to 10-11 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', 'T2 Security Chip', '16" Option'],
        releaseYear: 2019
    },
};

// ------------------------------------------------------------------
// PRODUCTS FROM SHEET (Premium Used)
// Note: Using "-inch" format instead of quotes for URL-safe slugs
// ------------------------------------------------------------------
const PRODUCTS_TO_SEED = [
    // === MacBook Air Intel ===
    { name: 'MacBook Air 11-inch 2015 i5 4GB 128GB', specs: 'MacBook Air 2015 Intel', ram: '4GB', storage: '128GB', price: 200000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2015 i5 8GB 128GB', specs: 'MacBook Air 2015 Intel', ram: '8GB', storage: '128GB', price: 230000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2015 i5 8GB 256GB', specs: 'MacBook Air 2015 Intel', ram: '8GB', storage: '256GB', price: 250000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2017 i5 8GB 128GB', specs: 'MacBook Air 2017 Intel', ram: '8GB', storage: '128GB', price: 300000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2017 i5 8GB 256GB', specs: 'MacBook Air 2017 Intel', ram: '8GB', storage: '256GB', price: 480000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2018 i5 8GB 128GB', specs: 'MacBook Air 2018 Intel', ram: '8GB', storage: '128GB', price: 420000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2018 i5 8GB 256GB', specs: 'MacBook Air 2018 Intel', ram: '8GB', storage: '256GB', price: 460000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2019 i5 8GB 128GB', specs: 'MacBook Air 2019 Intel', ram: '8GB', storage: '128GB', price: 420000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2019 i5 8GB 256GB', specs: 'MacBook Air 2019 Intel', ram: '8GB', storage: '256GB', price: 530000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2019 i5 16GB 256GB', specs: 'MacBook Air 2019 Intel', ram: '16GB', storage: '256GB', price: 550000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2019 i5 16GB 512GB', specs: 'MacBook Air 2019 Intel', ram: '16GB', storage: '512GB', price: 570000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2019 i5 16GB 1TB', specs: 'MacBook Air 2019 Intel', ram: '16GB', storage: '1TB', price: 600000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 i3 8GB 128GB', specs: 'MacBook Air 2020 Intel', ram: '8GB', storage: '128GB', price: 400000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 i3 8GB 256GB', specs: 'MacBook Air 2020 Intel', ram: '8GB', storage: '256GB', price: 500000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 i3 16GB 256GB', specs: 'MacBook Air 2020 Intel', ram: '16GB', storage: '256GB', price: 540000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 i5 8GB 256GB', specs: 'MacBook Air 2020 Intel', ram: '8GB', storage: '256GB', price: 570000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 i5 8GB 512GB', specs: 'MacBook Air 2020 Intel', ram: '8GB', storage: '512GB', price: 600000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 i7 16GB 512GB', specs: 'MacBook Air 2020 Intel', ram: '16GB', storage: '512GB', price: 700000, condition: 'Premium Used' },

    // === MacBook Air Apple Silicon ===
    { name: 'MacBook Air 13-inch 2020 M1 8GB 256GB', specs: 'MacBook Air 2020 M1', ram: '8GB', storage: '256GB', price: 750000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 M1 8GB 512GB', specs: 'MacBook Air 2020 M1', ram: '8GB', storage: '512GB', price: 800000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2020 M1 16GB 512GB', specs: 'MacBook Air 2020 M1', ram: '16GB', storage: '512GB', price: 870000, condition: 'Premium Used' },
    { name: 'MacBook Air 15-inch 2020 M1 8GB 256GB', specs: 'MacBook Air 2020 M1', ram: '8GB', storage: '256GB', price: 850000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2022 M2 8GB 256GB', specs: 'MacBook Air 2022 M2', ram: '8GB', storage: '256GB', price: 1050000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2022 M2 8GB 512GB', specs: 'MacBook Air 2022 M2', ram: '8GB', storage: '512GB', price: 1100000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2022 M2 16GB 256GB', specs: 'MacBook Air 2022 M2', ram: '16GB', storage: '256GB', price: 1100000, condition: 'Premium Used' },
    { name: 'MacBook Air 15-inch 2024 M3 8GB 256GB', specs: 'MacBook Air 2024 M3', ram: '8GB', storage: '256GB', price: 1120000, condition: 'Premium Used' },
    { name: 'MacBook Air 15-inch 2024 M3 16GB 256GB', specs: 'MacBook Air 2024 M3', ram: '16GB', storage: '256GB', price: 1220000, condition: 'Premium Used' },
    { name: 'MacBook Air 13-inch 2025 M4 16GB 256GB', specs: 'MacBook Air 2025 M4', ram: '16GB', storage: '256GB', price: 1380000, condition: 'Premium Used' },

    // === MacBook Pro Intel ===
    { name: 'MacBook Pro 13-inch 2014 i5 8GB 128GB', specs: 'MacBook Pro 2014 Intel', ram: '8GB', storage: '128GB', price: 280000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2015 i5 8GB 256GB', specs: 'MacBook Pro 2015 Intel', ram: '8GB', storage: '256GB', price: 360000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2015 i7 16GB 512GB', specs: 'MacBook Pro 2015 Intel', ram: '16GB', storage: '512GB', price: 430000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2016 i5 8GB 256GB TouchBar', specs: 'MacBook Pro 2016 Intel TouchBar', ram: '8GB', storage: '256GB', price: 490000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2016 i5 8GB 512GB TouchBar', specs: 'MacBook Pro 2016 Intel TouchBar', ram: '8GB', storage: '512GB', price: 540000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2016 i5 16GB 256GB TouchBar', specs: 'MacBook Pro 2016 Intel TouchBar', ram: '16GB', storage: '256GB', price: 550000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2016 i5 16GB 512GB TouchBar', specs: 'MacBook Pro 2016 Intel TouchBar', ram: '16GB', storage: '512GB', price: 590000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2016 i7 16GB 256GB 2GB vRAM TouchBar', specs: 'MacBook Pro 2016 Intel TouchBar', ram: '16GB', storage: '256GB', price: 580000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2016 i7 16GB 512GB 2GB vRAM TouchBar', specs: 'MacBook Pro 2016 Intel TouchBar', ram: '16GB', storage: '512GB', price: 500000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2017 i5 8GB 256GB Non-TouchBar', specs: 'MacBook Pro 2017 Intel Non-TouchBar', ram: '8GB', storage: '256GB', price: 450000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2017 i5 16GB 256GB Non-TouchBar', specs: 'MacBook Pro 2017 Intel Non-TouchBar', ram: '16GB', storage: '256GB', price: 480000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2017 i7 16GB 512GB Non-TouchBar', specs: 'MacBook Pro 2017 Intel Non-TouchBar', ram: '16GB', storage: '512GB', price: 510000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2017 i5 8GB 256GB TouchBar', specs: 'MacBook Pro 2017 Intel TouchBar', ram: '8GB', storage: '256GB', price: 500000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2017 i5 16GB 256GB TouchBar', specs: 'MacBook Pro 2017 Intel TouchBar', ram: '16GB', storage: '256GB', price: 560000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2017 i7 16GB 512GB TouchBar', specs: 'MacBook Pro 2017 Intel TouchBar', ram: '16GB', storage: '512GB', price: 600000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2017 i7 16GB 1TB TouchBar', specs: 'MacBook Pro 2017 Intel TouchBar', ram: '16GB', storage: '1TB', price: 680000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2017 i7 16GB 256GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2017 Intel TouchBar', ram: '16GB', storage: '256GB', price: 640000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2017 i7 16GB 512GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2017 Intel TouchBar', ram: '16GB', storage: '512GB', price: 680000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2018 i5 16GB 512GB TouchBar', specs: 'MacBook Pro 2018 Intel TouchBar', ram: '16GB', storage: '512GB', price: 650000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2018 i7 16GB 512GB TouchBar', specs: 'MacBook Pro 2018 Intel TouchBar', ram: '16GB', storage: '512GB', price: 700000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2018 i7 16GB 256GB TouchBar', specs: 'MacBook Pro 2018 Intel TouchBar', ram: '16GB', storage: '256GB', price: 700000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2018 i7 16GB 512GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2018 Intel TouchBar', ram: '16GB', storage: '512GB', price: 750000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2018 i7 32GB 512GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2018 Intel TouchBar', ram: '32GB', storage: '512GB', price: 790000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2018 i9 32GB 1TB 4GB vRAM TouchBar', specs: 'MacBook Pro 2018 Intel TouchBar', ram: '32GB', storage: '1TB', price: 820000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2019 i5 8GB 128GB TouchBar', specs: 'MacBook Pro 2019 Intel TouchBar', ram: '8GB', storage: '128GB', price: 560000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2019 i5 16GB 256GB TouchBar', specs: 'MacBook Pro 2019 Intel TouchBar', ram: '16GB', storage: '256GB', price: 700000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2019 i5 16GB 512GB TouchBar', specs: 'MacBook Pro 2019 Intel TouchBar', ram: '16GB', storage: '512GB', price: 780000, condition: 'Premium Used' },
    { name: 'MacBook Pro 13-inch 2019 i7 16GB 512GB TouchBar', specs: 'MacBook Pro 2019 Intel TouchBar', ram: '16GB', storage: '512GB', price: 770000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2019 i7 32GB 512GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel TouchBar', ram: '32GB', storage: '512GB', price: 800000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2019 i9 16GB 1TB 4GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel TouchBar', ram: '16GB', storage: '1TB', price: 820000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2019 i7 16GB 512GB 4GB vRAM TouchBar', specs: 'MacBook Pro 2019 Intel TouchBar', ram: '16GB', storage: '512GB', price: 770000, condition: 'Premium Used' },
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
    description += `- ✅ **Clean Install:** Fresh macOS installation\n`;
    description += `- ✅ **Full Functionality:** All features work perfectly\n`;
    description += `- ✅ **Battery Health:** 80%+ capacity verified\n`;
    description += `- ⚠️ **Why Premium Used:** Significant savings vs. new pricing\n`;

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
| **Features** | ${specs.features.join(', ')} |

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR **₦${monthlyPayment.toLocaleString()}/month × 10** (BNPL)
- ✅ **Guaranteed Quality:** Premium Used with Full Verification
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 90-day warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [MacBook Air M4 (New)](/ogabassey/macbook) - Latest MacBook Air
- [MacBook Pro M4 Pro (New)](/ogabassey/macbook) - Pro Performance
`;

    return description.trim();
}

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function seedPremiumUsedMacBooks() {
    console.log("💻 Starting Premium Used MacBook Import...\n");

    // Get MacBook category
    const { data: macbookCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'macbook').single();
    if (!macbookCat) {
        console.error("❌ 'MacBook' category not found. Please run seed-macbooks.ts first.");
        return;
    }
    const merchantId = macbookCat.merchant_id;
    const categoryId = macbookCat.id;

    console.log(`🌱 Seeding ${PRODUCTS_TO_SEED.length} Premium Used MacBook products...\n`);

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

        // Premium Used = 'used' in DB
        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: p.price,
            cost_price: Math.round(p.price * 0.80), // ~20% margin on used
            compare_at_price: null,
            description: description,
            metadata: metadata,
            category: 'Laptops',
            status: 'active',
            stock: 2,
            condition: 'used',
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

    console.log(`\n🏁 Premium Used MacBook Seeding Complete!`);
    console.log(`   Created: ${created} | Skipped: ${skipped}`);
}

seedPremiumUsedMacBooks();
