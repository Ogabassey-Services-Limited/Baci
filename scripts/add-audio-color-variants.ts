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

// Product color mappings (Researched)
const COLOR_VARIANTS = {
    // JBL Speakers
    'jbl-go-3': { base_cost: 50000, colors: ['Black', 'Blue', 'Red', 'Teal', 'Pink', 'White'] },
    'jbl-go-4': { base_cost: 55000, colors: ['Black', 'Blue', 'Red', 'Pink', 'Purple'] },
    'jbl-clip-5': { base_cost: 68000, colors: ['Black', 'Blue', 'Red', 'Camo', 'Pink'] },
    'jbl-flip-6': { base_cost: 120000, colors: ['Black', 'Blue', 'Red', 'Teal', 'Grey', 'White', 'Pink'] },
    'jbl-flip-7': { base_cost: 135000, colors: ['Black', 'Blue', 'Red', 'Purple', 'Camo'] },
    'jbl-charge-5': { base_cost: 159000, colors: ['Black', 'Blue', 'Red', 'Grey', 'Teal'], color_costs: { 'Camo': 160000 } },
    'jbl-charge-6': { base_cost: 178000, colors: ['Black', 'Blue', 'Red', 'Camo', 'White', 'Purple', 'Sand'] },
    'jbl-xtreme-3': { base_cost: 340000, colors: ['Black', 'Blue', 'Camo'] },
    'jbl-xtreme-4': { base_cost: 335000, colors: ['Black', 'Blue'], color_costs: { 'Camo': 338000 } },
    'jbl-boombox-3': { base_cost: 515000, colors: ['Black', 'Camo'] },
    'jbl-boombox-4': { base_cost: 650000, colors: ['Black', 'Camo'] },

    // PS5 Controller
    'playstation-5-dualsense-controller': { base_cost: 92000, colors: ['White'], color_costs: { 'Camo': 93000 } },
};

const COLOR_HEX: Record<string, string> = {
    'Black': '#000000',
    'White': '#FFFFFF',
    'Blue': '#0066CC',
    'Red': '#CC0000',
    'Teal': '#008080',
    'Pink': '#FF69B4',
    'Purple': '#800080',
    'Grey': '#808080',
    'Camo': '#8B7355',
    'Sand': '#C2B280'
};

async function addColorVariants() {
    console.log("🚀 Adding Color Variants to Audio Products...");

    const { data: merchant } = await supabase.from('merchants').select('id').eq('slug', 'ogabassey').single();
    if (!merchant) throw new Error("Merchant not found");
    const merchantId = merchant.id;

    let totalVariants = 0;

    for (const [slug, config] of Object.entries(COLOR_VARIANTS)) {
        // Get product
        const { data: product } = await supabase.from('products').select('id, name').eq('slug', slug).single();

        if (!product) {
            console.log(`⚠️  Product not found: ${slug}`);
            continue;
        }

        console.log(`\n📦 Adding variants to: ${product.name}`);

        for (const color of config.colors) {
            const variantCost = config.color_costs?.[color] || config.base_cost;
            const variantPrice = Math.ceil(variantCost * 1.2);
            const sku = `${slug}-${color.toLowerCase().replace(/\s+/g, '-')}`;

            const { error } = await supabase.from('product_variants').insert({
                product_id: product.id,
                merchant_id: merchantId,
                sku: sku,
                price_override: variantPrice,
                cost_price: variantCost,
                stock_quantity: 5,
                attributes: {
                    color: color,
                    color_hex: COLOR_HEX[color] || '#808080'
                }
            });

            if (error) {
                console.error(`  ❌ ${color}: ${error.message}`);
            } else {
                console.log(`  ✅ ${color}`);
                totalVariants++;
            }
        }
    }

    console.log(`\n🎉 Complete! Added ${totalVariants} color variants.`);
}

addColorVariants().catch(console.error);
