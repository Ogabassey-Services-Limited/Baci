import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Comprehensive color database by brand (Researched 2024/2025)
const BRAND_COLORS: Record<string, string[]> = {
    // Samsung - Common across Galaxy A series
    'Samsung': ['Awesome Lime', 'Awesome Graphite', 'Awesome Violet', 'Awesome White', 'Awe some Silver', 'Black', 'Light Green', 'Dark Red'],

    // Infinix - Hot, Note, Smart series
    'Infinix': ['Palm Blue', 'Horizon Gold', 'Starlit Black', 'Starfall Green', 'Interstellar Blue', 'Timber Black', 'Shiny Gold', 'Crystal Green', 'Galaxy White', 'Obsidian Black'],

    // Tecno - Spark, Camon, Phantom series
    'Tecno': ['Gravity Black', 'Cyber White', 'Neon Gold', 'Magic Skin Blue', 'Stardust Gray', 'Moonlight Silver', 'Uyuni Salt White', 'Iceland Basaltic Dark', 'Sahara Sand Brown'],

    // Xiaomi/Redmi/Poco
    'Xiaomi': ['Mirror Black', 'Snowstorm White', 'Ocean Teal', 'Arctic White', 'Graphite Black', 'Chromatic Purple', 'Mint Green', 'Ice Blue', 'Midnight Black', 'Gold'],

    // Oppo
    'Oppo': ['Starry Black', 'Moonlight Silver', 'Aurora Green', 'Pearl White', 'Dreamy White', 'Cosmic Blue'],

    // vivo
    'vivo': ['Space Black', 'Mint Green', 'Glacier Blue', 'Diamond Black', 'Titanium Gold', 'Nebula Purple', 'Freestyle White', 'Emerald Green', 'Moonlit Blue'],

    // itel - Basic colors
    'itel': ['Black', 'Blue', 'Green', 'Gold', 'Purple']
};

const COLOR_HEX: Record<string, string> = {
    // Samsung
    'Awesome Lime': '#C6E377',
    'Awesome Graphite': '#3C3C3C',
    'Awesome Violet': '#9370DB',
    'Awesome White': '#FFFFFF',
    'Awesome Silver': '#C0C0C0',
    'Light Green': '#90EE90',
    'Dark Red': '#8B0000',

    // Infinix
    'Palm Blue': '#00A3E0',
    'Horizon Gold': '#FFD700',
    'Starlit Black': '#000000',
    'Starfall Green': '#00A86B',
    'Interstellar Blue': '#4169E1',
    'Timber Black': '#101010',
    'Shiny Gold': '#FFD700',
    'Crystal Green': '#50C878',
    'Galaxy White': '#F8F8FF',
    'Obsidian Black': '#0B1B1A',

    // Tecno
    'Gravity Black': '#000000',
    'Cyber White': '#FFFFFF',
    'Neon Gold': '#FFD700',
    'Magic Skin Blue': '#0066CC',
    'Stardust Gray': '#808080',
    'Moonlight Silver': '#C0C0C0',
    'Uyuni Salt White': '#F5F5F5',
    'Iceland Basaltic Dark': '#2F4F4F',
    'Sahara Sand Brown': '#C19A6B',

    // Xiaomi
    'Mirror Black': '#000000',
    'Snowstorm White': '#FFFFFF',
    'Ocean Teal': '#008080',
    'Arctic White': '#F0F8FF',
    'Graphite Black': '#3C3C3C',
    'Chromatic Purple': '#800080',
    'Mint Green': '#98FF98',
    'Ice Blue': '#B0E0E6',
    'Midnight Black': '#191970',

    // Oppo
    'Starry Black': '#000000',
    'Moonlight Silver': '#CCCCCC',
    'Aurora Green': '#00FA9A',
    'Pearl White': '#FAEBD7',
    'Dreamy White': '#FFFAFA',
    'Cosmic Blue': '#4682B4',

    // vivo
    'Space Black': '#000000',
    'Glacier Blue': '#ADD8E6',
    'Diamond Black': '#0A0A0A',
    'Titanium Gold': '#DAA520',
    'Nebula Purple': '#9932CC',
    'Freestyle White': '#FFFFFF',
    'Emerald Green': '#50C878',
    'Moonlit Blue': '#6495ED',

    // Generic
    'Black': '#000000',
    'White': '#FFFFFF',
    'Blue': '#0066CC',
    'Green': '#00A86B',
    'Gold': '#FFD700',
    'Purple': '#800080',
    'Silver': '#C0C0C0'
};

async function addSmartphoneColorVariants() {
    console.log("🚀 Adding Color Variants to All Smartphones...");

    const { data: merchant } = await supabase.from('merchants').select('id').eq('slug', 'ogabassey').single();
    if (!merchant) throw new Error("Merchant not found");
    const merchantId = merchant.id;

    // Get all smartphones by brand
    const brandKeys = Object.keys(BRAND_COLORS);
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, price, cost_price, metadata')
        .or(brandKeys.map(brand => `metadata->>brand.eq.${brand}`).join(','))
        .order('name');

    if (error) {
        console.error("❌ Failed to fetch products:", error.message);
        return;
    }

    console.log(`📱 Found ${products.length} smartphones to process\n`);

    let totalVariants = 0;
    let processedProducts = 0;
    let skippedProducts = 0;

    for (const product of products) {
        const brand = product.metadata?.brand;
        const productType = product.metadata?.type || '';
        const productName = product.name.toLowerCase();

        // Skip non-smartphones (TVs, audio, gaming, etc.)
        if (productName.includes(' tv') ||
            productName.includes('soundbar') ||
            productName.includes('speaker') ||
            productName.includes('playstation') ||
            productName.includes('ps5') ||
            productName.includes('ps4') ||
            productName.includes('airpods') ||
            productName.includes('jbl') ||
            productType.toLowerCase().includes('tv') ||
            productType.toLowerCase().includes('audio') ||
            productType.toLowerCase().includes('gaming')) {
            continue; // Skip silently
        }

        if (!brand || !BRAND_COLORS[brand]) {
            console.log(`⚠️  Skipping ${product.name} (unknown brand: ${brand})`);
            skippedProducts++;
            continue;
        }

        const colors = BRAND_COLORS[brand];
        console.log(`📦 ${product.name} (${brand})`);

        let variantsAdded = 0;
        for (const color of colors) {
            const sku = `${product.slug}-${color.toLowerCase().replace(/\s+/g, '-')}`;

            const { error: variantError } = await supabase.from('product_variants').insert({
                product_id: product.id,
                merchant_id: merchantId,
                sku: sku,
                price_override: product.price,
                cost_price: product.cost_price,
                stock_quantity: 3,
                attributes: {
                    color: color,
                    color_hex: COLOR_HEX[color] || '#808080'
                }
            });

            if (variantError) {
                // Skip duplicate errors silently (product might already have variants)
                if (!variantError.message.includes('duplicate')) {
                    console.error(`  ❌ ${color}: ${variantError.message}`);
                }
            } else {
                variantsAdded++;
                totalVariants++;
            }
        }

        if (variantsAdded > 0) {
            console.log(`  ✅ Added ${variantsAdded} color variants`);
            processedProducts++;
        } else {
            console.log(`  ⚠️  No new variants added (may already exist)`);
        }
    }

    console.log(`\n🎉 Complete!`);
    console.log(`   Products processed: ${processedProducts}`);
    console.log(`   Products skipped: ${skippedProducts}`);
    console.log(`   Total variants added: ${totalVariants}`);
}

addSmartphoneColorVariants().catch(console.error);
