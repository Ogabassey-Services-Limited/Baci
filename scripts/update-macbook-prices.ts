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
// NEW COST PRICE LIST (from user)
// ------------------------------------------------------------------
const COST_PRICE_UPDATES = [
    // === MacBook Pro 13" ===
    { pattern: 'MacBook Pro 2017%13%i5%8GB%256GB%Non%TouchBar', costPrice: 450000 },
    { pattern: 'MacBook Pro 2017%13%i5%16GB%256GB%Non%TouchBar', costPrice: 480000 },
    { pattern: 'MacBook Pro 2018%13%i5%8GB%512GB%TouchBar', costPrice: 560000 },
    { pattern: 'MacBook Pro 2018%13%i7%8GB%512GB%TouchBar', costPrice: 590000 },
    { pattern: 'MacBook Pro 2019%13%i5%8GB%256GB%TouchBar', costPrice: 560000 },
    { pattern: 'MacBook Pro 2019%13%i5%16GB%256GB%TouchBar', costPrice: 600000 },
    { pattern: 'MacBook Pro 2020%13%i5%16GB%512GB%TouchBar', costPrice: 670000 },
    { pattern: 'MacBook Pro 2020%13%i7%16GB%512GB%TouchBar', costPrice: 720000 },
    { pattern: 'MacBook Pro 2020%13%i7%32GB%1TB%TouchBar', costPrice: 950000 },
    { pattern: 'MacBook Pro%2020%M1%8GB%256GB', costPrice: 840000 },
    { pattern: 'MacBook Pro%2020%M1%8GB%512GB', costPrice: 920000 },
    { pattern: 'MacBook Pro%2020%M1%16GB%256GB', costPrice: 920000 },
    { pattern: 'MacBook Pro%2020%M1%16GB%512GB', costPrice: 1030000 },
    { pattern: 'MacBook Pro%2022%M2%8GB%512GB', costPrice: 1100000 },
    { pattern: 'MacBook Pro%2021%14%M1%16GB%512GB', costPrice: 1270000 },
    { pattern: 'MacBook Pro%2023%14%M3%8GB%512GB', costPrice: 1630000 },

    // === MacBook Pro 15" ===
    { pattern: 'MacBook Pro 2016%15%i7%16GB%1TB', costPrice: 500000 },
    { pattern: 'MacBook Pro 2017%15%i7%16GB%512GB', costPrice: 580000 },
    { pattern: 'MacBook Pro 2018%15%i7%16GB%512GB', costPrice: 680000 },
    { pattern: 'MacBook Pro 2019%15%i7%32GB%512GB', costPrice: 730000 },
    { pattern: 'MacBook Pro 2019%15%i9%32GB%512GB', costPrice: 750000 },
    { pattern: 'MacBook Pro 2019%15%i7%16GB%1TB', costPrice: 730000 },
    { pattern: 'MacBook Pro 2019%15%i9%16GB%512GB', costPrice: 750000 },
    { pattern: 'MacBook Pro 2015%15%i7%16GB%512GB', costPrice: 430000 },

    // === MacBook Pro 16" ===
    { pattern: 'MacBook Pro%2019%16%i9%32GB%1TB%8GB%vRAM', costPrice: 930000 },
    { pattern: 'MacBook Pro%2019%16%i9%16GB%512GB%4GB%vRAM', costPrice: 750000 },
    { pattern: 'MacBook Pro%2019%16%i9%16GB%1TB%4GB%vRAM', costPrice: 770000 },
    { pattern: 'MacBook Pro%2019%16%i9%32GB%512GB%4GB%vRAM', costPrice: 770000 },
    { pattern: 'MacBook Pro%2021%16%M1%Pro%16GB%512GB', costPrice: 1500000 },
    { pattern: 'MacBook Pro%2021%16%M1%Pro%32GB%512GB', costPrice: 1400000 },
    { pattern: 'MacBook Pro%2021%16%M1%Max%32GB%512GB', costPrice: 1700000 },
    { pattern: 'MacBook Pro%2021%16%M1%Pro%32GB%1TB', costPrice: 1700000 },
    { pattern: 'MacBook Pro%2021%16%M1%Max%32GB%1TB', costPrice: 1800000 },
    { pattern: 'MacBook Pro%2021%16%M1%Max%32GB%2TB', costPrice: 1900000 },
    { pattern: 'MacBook Pro%2021%16%M1%Max%64GB%2TB', costPrice: 2050000 },

    // === MacBook Air ===
    { pattern: 'MacBook Air%2019%13%i5%16GB%512GB', costPrice: 590000 },
    { pattern: 'MacBook Air%2019%13%i5%16GB%1TB', costPrice: 640000 },
    { pattern: 'MacBook Air%2020%13%i5%8GB%512GB', costPrice: 600000 },
    { pattern: 'MacBook Air%2020%M1%8GB%256GB', costPrice: 650000 },
    { pattern: 'MacBook Air%2020%M1%8GB%512GB', costPrice: 700000 },
    { pattern: 'MacBook Air%2020%M1%16GB%256GB', costPrice: 700000 },
    { pattern: 'MacBook Air%2020%M1%16GB%512GB', costPrice: 850000 },
];

// ------------------------------------------------------------------
// MISSING MACBOOKS TO ADD (with price calculated from cost + 15% margin)
// ------------------------------------------------------------------
const MACBOOK_SPECS: Record<string, any> = {
    'MacBook Pro 2016 Intel 15"': {
        display: '15.4" Retina (2880x1800)',
        processor: 'Intel Core i7 (6th Gen)',
        battery: 'Up to 10 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', '2GB Radeon Pro Graphics'],
        releaseYear: 2016
    },
    'MacBook Pro 2019 Intel 15"': {
        display: '15.4" Retina (2880x1800)',
        processor: 'Intel Core i7/i9 (9th Gen)',
        battery: 'Up to 10 hours',
        ports: '4x Thunderbolt 3, 3.5mm audio',
        features: ['Touch Bar', '4GB Radeon Pro Graphics', 'T2 Chip'],
        releaseYear: 2019
    },
    'MacBook Pro 2021 M1 Pro 16"': {
        display: '16.2" Liquid Retina XDR (3456x2234, ProMotion)',
        processor: 'Apple M1 Pro (10-core CPU, 16-core GPU)',
        battery: 'Up to 21 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm',
        features: ['ProMotion', 'XDR Display', 'Mini-LED'],
        releaseYear: 2021
    },
    'MacBook Pro 2021 M1 Max 16"': {
        display: '16.2" Liquid Retina XDR (3456x2234, ProMotion)',
        processor: 'Apple M1 Max (10-core CPU, 32-core GPU)',
        battery: 'Up to 21 hours',
        ports: 'MagSafe 3, 3x Thunderbolt 4, HDMI, SDXC, 3.5mm',
        features: ['ProMotion', 'XDR Display', 'Up to 64GB RAM'],
        releaseYear: 2021
    },
};

const MISSING_MACBOOKS = [
    // MacBook Pro 15" (2016)
    { name: 'MacBook Pro 15-inch 2016 i7 16GB 1TB 2GB Radeon TouchBar', specs: 'MacBook Pro 2016 Intel 15"', ram: '16GB', storage: '1TB', costPrice: 500000, condition: 'Premium Used' },

    // MacBook Pro 15" (2019) - multiple variants
    { name: 'MacBook Pro 15-inch 2019 i7 32GB 512GB 4GB Radeon TouchBar', specs: 'MacBook Pro 2019 Intel 15"', ram: '32GB', storage: '512GB', costPrice: 730000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2019 i9 32GB 512GB 4GB Radeon TouchBar', specs: 'MacBook Pro 2019 Intel 15"', ram: '32GB', storage: '512GB', costPrice: 750000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2019 i7 16GB 1TB 4GB Radeon TouchBar', specs: 'MacBook Pro 2019 Intel 15"', ram: '16GB', storage: '1TB', costPrice: 730000, condition: 'Premium Used' },
    { name: 'MacBook Pro 15-inch 2019 i9 16GB 512GB 4GB Radeon TouchBar', specs: 'MacBook Pro 2019 Intel 15"', ram: '16GB', storage: '512GB', costPrice: 750000, condition: 'Premium Used' },

    // MacBook Pro 16" (2021) M1 Pro - additional variants
    { name: 'MacBook Pro 16-inch 2021 M1 Pro 32GB 512GB', specs: 'MacBook Pro 2021 M1 Pro 16"', ram: '32GB', storage: '512GB', costPrice: 1400000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2021 M1 Pro 32GB 1TB', specs: 'MacBook Pro 2021 M1 Pro 16"', ram: '32GB', storage: '1TB', costPrice: 1700000, condition: 'Premium Used' },

    // MacBook Pro 16" (2021) M1 Max - additional variants
    { name: 'MacBook Pro 16-inch 2021 M1 Max 32GB 512GB', specs: 'MacBook Pro 2021 M1 Max 16"', ram: '32GB', storage: '512GB', costPrice: 1700000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2021 M1 Max 32GB 2TB', specs: 'MacBook Pro 2021 M1 Max 16"', ram: '32GB', storage: '2TB', costPrice: 1900000, condition: 'Premium Used' },
    { name: 'MacBook Pro 16-inch 2021 M1 Max 64GB 2TB', specs: 'MacBook Pro 2021 M1 Max 16"', ram: '64GB', storage: '2TB', costPrice: 2050000, condition: 'Premium Used' },
];

// ------------------------------------------------------------------
// MAIN SCRIPT
// ------------------------------------------------------------------
async function updateMacBookCostPrices() {
    console.log("💻 Updating MacBook Cost Prices...\n");

    // Part 1: Update existing products
    console.log("📊 Part 1: Updating cost prices for existing MacBooks...\n");

    let updated = 0;
    let notFound = 0;

    for (const item of COST_PRICE_UPDATES) {
        // Convert pattern to SQL ILIKE pattern
        const sqlPattern = item.pattern;

        // Find matching products
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, cost_price, price')
            .ilike('name', `%${sqlPattern.split('%').join('%')}%`);

        if (error) {
            console.error("❌ Error searching for:", item.pattern, error.message);
            continue;
        }

        if (!products || products.length === 0) {
            // Try a more flexible search by splitting the pattern
            const terms = item.pattern.split('%').filter(t => t.length > 2);
            let query = supabase.from('products').select('id, name, cost_price, price');

            for (const term of terms) {
                query = query.ilike('name', `%${term}%`);
            }

            const { data: flexProducts } = await query;

            if (!flexProducts || flexProducts.length === 0) {
                console.log("⚠️ No match found for:", item.pattern);
                notFound++;
                continue;
            }

            // Update each match
            for (const prod of flexProducts) {
                if (prod.cost_price !== item.costPrice) {
                    await supabase.from('products').update({ cost_price: item.costPrice }).eq('id', prod.id);
                    console.log("   ✅ Updated:", prod.name);
                    console.log("      Cost: ₦" + (prod.cost_price?.toLocaleString() || 'N/A') + " → ₦" + item.costPrice.toLocaleString());
                    updated++;
                }
            }
        } else {
            // Update each match
            for (const prod of products) {
                if (prod.cost_price !== item.costPrice) {
                    await supabase.from('products').update({ cost_price: item.costPrice }).eq('id', prod.id);
                    console.log("   ✅ Updated:", prod.name);
                    console.log("      Cost: ₦" + (prod.cost_price?.toLocaleString() || 'N/A') + " → ₦" + item.costPrice.toLocaleString());
                    updated++;
                }
            }
        }
    }

    console.log(`\n   Updated: ${updated} | Not found: ${notFound}\n`);

    // Part 2: Add missing MacBooks
    console.log("📊 Part 2: Adding missing MacBooks...\n");

    // Get MacBook category
    const { data: macbookCat } = await supabase.from('categories').select('id, merchant_id').eq('slug', 'macbook').single();
    if (!macbookCat) {
        console.error("❌ 'MacBook' category not found.");
        return;
    }
    const merchantId = macbookCat.merchant_id;
    const categoryId = macbookCat.id;

    let created = 0;
    let skipped = 0;

    for (const p of MISSING_MACBOOKS) {
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
            console.log("   ⏩ Skipping existing:", fullName);
            skipped++;
            continue;
        }

        // Calculate price with 15% margin
        const price = Math.round(p.costPrice * 1.15 / 100) * 100;

        const metadata: any = {
            brand: 'Apple',
            model: p.name,
            ram: p.ram,
            storage: p.storage,
            condition: p.condition,
            releaseYear: specs.releaseYear,
        };

        const priceStr = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);
        const monthlyPayment = Math.ceil(price / 10);

        const description = `## ${p.name} Price in Nigeria

The **${p.name}** is available at Ogabassey for **${priceStr}**, or pay **₦${monthlyPayment.toLocaleString()}/month × 10** via BNPL. Powered by the **${specs.processor}** with **${specs.display}**. Features: ${specs.features.join(', ')}.

## Condition: Premium Used (Grade A)

- ✅ **Tested & Certified:** Full diagnostics passed
- ✅ **90%+ Condition:** Minor cosmetic wear only
- ✅ **Battery Health:** 80%+ verified

## Specifications

| Spec | Value |
|------|-------|
| **RAM** | ${p.ram} |
| **Storage** | ${p.storage} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **Battery** | ${specs.battery} |

## Why Buy from Ogabassey?

- ✅ **BNPL:** ₦${monthlyPayment.toLocaleString()}/month × 10
- ✅ **Warranty:** 90-day warranty
- ✅ **Delivery:** Same-day Lagos, 2-5 days nationwide
`;

        console.log("   ✨ Creating:", fullName);
        console.log("      Cost: ₦" + p.costPrice.toLocaleString() + " → Price: ₦" + price.toLocaleString());

        const { data: newProd, error } = await supabase.from('products').insert({
            name: fullName,
            slug: slug,
            merchant_id: merchantId,
            price: price,
            cost_price: p.costPrice,
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
            console.error("   ❌ Failed:", fullName, error.message);
        } else {
            await supabase.from('product_categories').insert({ product_id: newProd.id, category_id: categoryId });
            console.log(`   ✅ Created & Linked`);
            created++;
        }
    }

    console.log(`\n   Created: ${created} | Skipped: ${skipped}`);
    console.log(`\n🏁 MacBook Price Update Complete!`);
}

updateMacBookCostPrices();
