import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Configuration
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS79suokSEI2bT5wPq-DpNqoX8qXO8XvkNZdCodXHOR9d21GVHbR62IjfEdw12yuLXhTuJwS4q6J_dK/pub?output=csv';

// Supabase config (uses env vars from .env.local)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface PixelProduct {
    rawName: string;
    priceStr: string;
    model: string;
    ram: string;
    storage: string;
    condition: string;
    price: number;
}

// Regex for parsing: "Google Pixel 9 Pro 16GB 256GB (New)"
// Captures: 1=Model, 2=RAM, 3=Storage, 4=Condition
const PIXEL_REGEX = /Google Pixel (.+?) (\d+GB) (\d+GB|1TB) \((.+?)\)/i;

async function fetchCSV(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    return await response.text();
}

function parsePrice(priceStr: string): number {
    return Number(priceStr.replace(/[^0-9.]/g, ''));
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}


// Specifications Map for 2024/2025 Pixel Lineup & Legacy Models
// Sources: Google Store, GSMArena
const PIXEL_SPECS: Record<string, { display: string; processor: string; camera: string; battery: string; os: string; colors: string[] }> = {
    '9 Pro Fold': {
        display: '8.0" Super Actua Flex (Inner) / 6.3" Actua (Cover)',
        processor: 'Google Tensor G4',
        camera: '48MP Wide + 10.5MP Ultra Wide + 10.8MP 5x Telephoto',
        battery: '4650mAh (Typical)',
        os: 'Android 14 (7 years of updates)',
        colors: ['Porcelain', 'Obsidian']
    },
    '9 Pro XL': {
        display: '6.8" Super Actua LTPO OLED (1-120Hz)',
        processor: 'Google Tensor G4',
        camera: '50MP Wide + 48MP Ultra Wide + 48MP 5x Telephoto',
        battery: '5060mAh (Typical)',
        os: 'Android 14 (7 years of updates)',
        colors: ['Obsidian', 'Porcelain', 'Hazel', 'Rose Quartz']
    },
    '9 Pro': {
        display: '6.3" Super Actua LTPO OLED (1-120Hz)',
        processor: 'Google Tensor G4',
        camera: '50MP Wide + 48MP Ultra Wide + 48MP 5x Telephoto',
        battery: '4700mAh (Typical)',
        os: 'Android 14 (7 years of updates)',
        colors: ['Obsidian', 'Porcelain', 'Hazel', 'Rose Quartz']
    },
    '9': {
        display: '6.3" Actua OLED (60-120Hz)',
        processor: 'Google Tensor G4',
        camera: '50MP Wide + 48MP Ultra Wide',
        battery: '4700mAh (Typical)',
        os: 'Android 14 (7 years of updates)',
        colors: ['Obsidian', 'Porcelain', 'Wintergreen', 'Peony']
    },
    '8 Pro': {
        display: '6.7" Super Actua LTPO OLED (1-120Hz)',
        processor: 'Google Tensor G3',
        camera: '50MP Wide + 48MP Ultra Wide + 48MP 5x Telephoto',
        battery: '5050mAh (Typical)',
        os: 'Android 14',
        colors: ['Obsidian', 'Porcelain', 'Bay', 'Mint']
    },
    '8': {
        display: '6.2" Actua OLED (60-120Hz)',
        processor: 'Google Tensor G3',
        camera: '50MP Wide + 12MP Ultra Wide',
        battery: '4575mAh (Typical)',
        os: 'Android 14',
        colors: ['Obsidian', 'Hazel', 'Rose', 'Mint']
    },
    '8a': {
        display: '6.1" Actua OLED (120Hz)',
        processor: 'Google Tensor G3',
        camera: '64MP Wide + 13MP Ultra Wide',
        battery: '4492mAh (Typical)',
        os: 'Android 14',
        colors: ['Obsidian', 'Porcelain', 'Bay', 'Aloe']
    },
    '7 Pro': {
        display: '6.7" LTPO OLED (120Hz)',
        processor: 'Google Tensor G2',
        camera: '50MP Wide + 12MP Ultra Wide + 48MP 5x Telephoto',
        battery: '5000mAh',
        os: 'Android 13 (Upgradable)',
        colors: ['Obsidian', 'Snow', 'Hazel']
    },
    '7': {
        display: '6.3" OLED (90Hz)',
        processor: 'Google Tensor G2',
        camera: '50MP Wide + 12MP Ultra Wide',
        battery: '4355mAh',
        os: 'Android 13 (Upgradable)',
        colors: ['Obsidian', 'Snow', 'Lemongrass']
    },
    '7a': {
        display: '6.1" OLED (90Hz)',
        processor: 'Google Tensor G2',
        camera: '64MP Wide + 13MP Ultra Wide',
        battery: '4385mAh',
        os: 'Android 13 (Upgradable)',
        colors: ['Charcoal', 'Snow', 'Sea', 'Coral']
    },
    '6 Pro': {
        display: '6.7" LTPO OLED (120Hz)',
        processor: 'Google Tensor',
        camera: '50MP Wide + 12MP Ultra Wide + 48MP 4x Telephoto',
        battery: '5003mAh',
        os: 'Android 12 (Upgradable)',
        colors: ['Stormy Black', 'Cloudy White', 'Sorta Sunny']
    },
    '6': {
        display: '6.4" OLED (90Hz)',
        processor: 'Google Tensor',
        camera: '50MP Wide + 12MP Ultra Wide',
        battery: '4614mAh',
        os: 'Android 12 (Upgradable)',
        colors: ['Stormy Black', 'Kinda Coral', 'Sorta Seafoam']
    },
    '6a': {
        display: '6.1" OLED (60Hz)',
        processor: 'Google Tensor',
        camera: '12.2MP Wide + 12MP Ultra Wide',
        battery: '4410mAh',
        os: 'Android 12 (Upgradable)',
        colors: ['Sage', 'Chalk', 'Charcoal']
    },
    '4a': {
        display: '5.81" OLED',
        processor: 'Qualcomm Snapdragon 730G',
        camera: '12.2MP Dual-Pixel',
        battery: '3140mAh',
        os: 'Android 10 (Upgradable)',
        colors: ['Just Black', 'Barely Blue']
    }
};

const DEFAULT_SPECS = {
    display: 'High-resolution OLED Display',
    processor: 'Google Tensor Chip',
    camera: 'Advanced Pixel Camera System',
    battery: 'All-day Battery Life',
    os: 'Android'
};

function generateDescription(product: PixelProduct): string {
    const { model, priceStr, ram, storage, condition } = product;

    // Normalize model name for lookup (e.g., "9 Pro" matches directly, but be careful of extra spaces)
    const normalizedModel = model.trim();
    const specs = PIXEL_SPECS[normalizedModel] || DEFAULT_SPECS;

    // EAV Description Template based on ogabassey_content_strategy.md
    // Matches "Algorithmic Authorship" guidelines: Specific entities, numeric values, distinct sections.
    return `
## Google Pixel ${model} Price in Nigeria

The **Google Pixel ${model}** is available at Ogabassey for **${priceStr}**. Featuring a **${specs.display}** and the powerful **${specs.processor}** processor, this ${storage} storage model with ${ram} RAM helps you multitask locally with Gemini AI. This device is **${condition}** and ready for immediate delivery.

## Key Specifications

| Spec | Value |
|------|-------|
| **Condition** | ${condition} |
| **Display** | ${specs.display} |
| **Processor** | ${specs.processor} |
| **RAM** | ${ram} |
| **Storage** | ${storage} |
| **Main Camera** | ${specs.camera} |
| **Battery** | ${specs.battery} |
| **OS** | ${specs.os} |
| **Available Colors** | ${specs.colors ? specs.colors.join(', ') : 'Various'} |

## Why Buy from Ogabassey?

- ✅ **Flexible Payment:** Pay in full OR pay small-small (BNPL)
- ✅ **Guaranteed Quality:** ${condition === 'New' ? 'Brand New (Sealed)' : 'Verified Authentic UK Used'}
- ✅ **Speed:** Same-day delivery in Lagos, 2-5 days nationwide
- ✅ **Peace of Mind:** 12-month warranty & 7-day return policy
- ✅ **Support:** Physical office in Ikeja for repairs & swaps

## Related Products

- [Samsung Galaxy S24 Ultra](/smartphones/samsung/s24-ultra) - Direct Competitor
- [iPhone 16 Pro Max](/smartphones/apple/iphone-16-pro-max) - iOS Alternative
- [Google Pixel 8 Pro](/smartphones/google/pixel-8-pro) - Previous Generation
`;
}

async function run() {
    console.log('🚀 Starting Google Pixel Batch Import...');

    console.log(`📥 Fetching CSV from: ${SHEET_URL.substring(0, 50)}...`);
    const csvData = await fetchCSV(SHEET_URL);
    const rows = csvData.split('\n');

    console.log(`📊 Total rows found: ${rows.length}`);

    const productsToImport: PixelProduct[] = [];

    // Parse loop
    for (const row of rows) {
        // Simple CSV split (handling quoted money values is tricky with split(','), 
        // strictly for this specific sheet format we can expect "Name, \"Price\", ...")

        // Match explicit structure: Name, "Price", ...
        // Or Name, Price, ...
        // Logic: Extract name (first column) and price (second column)
        const parts = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma ignoring quotes
        if (parts.length < 2) continue;

        const name = parts[0]?.trim();
        const priceStr = parts[1]?.replace(/"/g, '').trim();

        if (!name || !name.toLowerCase().includes('google pixel')) continue;
        if (!priceStr) continue;

        const match = name.match(PIXEL_REGEX);
        if (match) {
            productsToImport.push({
                rawName: name,
                priceStr,
                model: match[1].trim(),
                ram: match[2].trim(),
                storage: match[3].trim(),
                condition: match[4].trim(),
                price: parsePrice(priceStr),
            });
        } else {
            // Try looser match if stricter regex fails (e.g. 128GB only)
            // For now, log skipped
            // console.log(`⚠️ Skipped (no regex match): ${name}`);
        }
    }

    console.log(`✅ Found ${productsToImport.length} valid Google Pixel products to import.\n`);

    // Fetch category ID for 'smartphones'
    const { data: categoryData, error: catError } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'smartphones')
        .single();

    if (catError || !categoryData) {
        console.error('❌ Error: Could not find "smartphones" category. Please create it first.');
        return;
    }

    const categoryId = categoryData.id;

    // Fetch Merchant ID for 'Ogabassey'
    const { data: merchantData, error: merchError } = await supabase
        .from('merchants')
        .select('id')
        .ilike('business_name', 'Ogabassey')
        .single();

    if (merchError || !merchantData) {
        console.error('❌ Error: Could not find "Ogabassey" merchant.');
        return;
    }
    const merchantId = merchantData.id;

    // Import loop
    for (const p of productsToImport) {
        const slug = generateSlug(p.rawName);
        console.log(`📦 Importing: ${p.rawName} -> ${slug}`);

        const productData = {
            id: crypto.randomUUID(), // New ID
            merchant_id: merchantId,
            name: p.rawName,
            slug: slug,
            description: generateDescription(p),
            price: p.price,
            // currency: 'NGN', // Removed: Column does not exist
            brand: 'Google',
            category: 'smartphones', // Fallback details
            images: [], // Placeholder, can be updated later
            stock: 5,   // Default stock
            status: 'active',
            condition: p.condition.toLowerCase().includes('new') && !p.condition.toLowerCase().includes('open') ? 'new' : 'used', // Map to strict constraint
            condition_detail: p.condition, // Store exact condition here
            metadata: {
                ram: p.ram,
                storage: p.storage,
                condition: p.condition,
                model: p.model,
                imported_from: 'google_sheet_batch'
            },
            meta_title: `Google Pixel ${p.model} ${p.storage} Price in Nigeria (${p.condition})`,
            meta_description: `Buy Google Pixel ${p.model} (${p.storage}, ${p.ram}) - ${p.condition} in Nigeria. Best price ${p.priceStr}. Pay small-small available. Same day delivery Lagos.`
        };

        // Upsert logic (check if slug exists first to avoid duplicates or update)
        const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('slug', slug)
            .single();

        let productId = existing?.id || productData.id;
        let result;

        if (existing) {
            console.log(`   🔄 Updating existing product...`);
            // Remove ID from update payload to prevent FK violation
            const { id, ...updateData } = productData;
            result = await supabase
                .from('products')
                .update(updateData)
                .eq('id', existing.id);
        } else {
            console.log(`   ✨ Creating new product...`);
            result = await supabase
                .from('products')
                .insert(productData);
        }

        if (result.error) {
            console.error(`   ❌ Error inserting product: ${result.error.message}`);
            continue;
        }

        // 3. Link to Category (Junction Table)
        const { error: linkError } = await supabase
            .from('product_categories')
            .upsert({
                product_id: productId,
                category_id: categoryId
            }, { onConflict: 'product_id,category_id' });

        if (linkError) {
            // Try assuming simple insert if unique constraint setup is unknown, or ignore if duplicate
            // console.error(`   ⚠️ Linking category failed: ${linkError.message}`);

            // Check if it's already there
            const { data: existingLink } = await supabase
                .from('product_categories')
                .select('*')
                .eq('product_id', productId)
                .eq('category_id', categoryId)
                .single();

            if (!existingLink) {
                await supabase.from('product_categories').insert({
                    product_id: productId,
                    category_id: categoryId
                });
            }
        } else {
            // console.log(`   🔗 Linked to category`);
        }

        console.log(`   ✅ Success`);
    }

    console.log('\n🏁 Batch Import Complete!');
}

run().catch(console.error);
