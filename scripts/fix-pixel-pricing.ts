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

async function fixPixelPricing() {
    console.log("🚀 Starting Google Pixel Pricing Update (Tiered Markup)...");

    // 1. Fetch Pixel Products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price, cost_price')
        .ilike('name', '%Google Pixel%');

    if (error) {
        console.error("❌ Error fetching products:", error);
        return;
    }

    console.log(`🔍 Found ${products.length} Google Pixel products.`);

    let updatedCount = 0;

    for (const p of products) {
        // Handle case where cost might already be in cost_price (if script ran partially)
        // But logic assumes 'price' holds the original cost if imported that way
        // Safer: If cost_price is set, assume that is the cost. If not, take price.
        // BUT wait, previous run moved price -> cost_price. So now cost_price IS set.
        // So we should base calc on cost_price if it exists, otherwise price.

        let costPrice = p.cost_price || p.price;

        // Calculate new Retail Price based on Tiered Markup
        // Rule: > 450k = 10%, 200k-445k = 15%, < 200k = 20%
        let markupMultiplier = 1.20; // Default < 200k

        if (costPrice > 450000) {
            markupMultiplier = 1.10;
        } else if (costPrice >= 200000) {
            markupMultiplier = 1.15;
        }

        let newPrice = costPrice * markupMultiplier;

        // Rounding to nearest 100 for neatness (optional but good for retail)
        newPrice = Math.ceil(newPrice / 100) * 100;

        console.log(`🔧 Updating: ${p.name}`);
        console.log(`   Cost Price:       ₦${costPrice.toLocaleString()}`);
        console.log(`   Markup:           ${((markupMultiplier - 1) * 100).toFixed(0)}%`);
        console.log(`   New Retail Price: ₦${newPrice.toLocaleString()}`);

        const { error: updateError } = await supabase
            .from('products')
            .update({
                cost_price: costPrice,
                price: newPrice
            })
            .eq('id', p.id);

        if (updateError) {
            console.error(`❌ Failed to update ${p.name}:`, updateError);
        } else {
            console.log(`✅ Updated successfully`);
            updatedCount++;
        }
    }

    console.log(`🏁 Pricing Update Complete! Updated ${updatedCount} products.`);
}

fixPixelPricing();
