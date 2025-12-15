
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupGsmArenaImages() {
    console.log('Starting cleanup of GSM Arena images...');

    // 1. Get 'ogabassey' merchant ID
    const { data: merchant, error: mError } = await supabase
        .from('merchants')
        .select('id, slug')
        .eq('slug', 'ogabassey')
        .single();

    if (mError || !merchant) {
        console.error('Merchant not found:', mError);
        return;
    }
    console.log(`Merchant: ${merchant.slug} (${merchant.id})`);

    // 2. Fetch all products for this merchant
    // We need to check them all because string search in JSONB array is tricky/slow in filter
    // It's safer to fetch the batch (it's not huge yet) and process in JS.
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, images')
        .eq('merchant_id', merchant.id);

    if (pError) {
        console.error('Error fetching products:', pError);
        return;
    }

    console.log(`Scanning ${products.length} products...`);

    let updateCount = 0;

    for (const p of products) {
        if (!p.images || !Array.isArray(p.images)) continue;

        const originalLength = p.images.length;
        // Filter out any string image that contains 'gsmarena'
        // Also handle object case if it exists (though script showed mostly strings/urls)
        const cleanImages = p.images.filter((img: any) => {
            const url = typeof img === 'string' ? img : img?.url;
            if (!url) return false; // Invalid entry
            return !url.includes('gsmarena.com');
        });

        if (cleanImages.length !== originalLength) {
            console.log(`Cleaning product: ${p.name} (${p.id})`);
            console.log(`  - Removed ${originalLength - cleanImages.length} GSM Arena links.`);

            const { error: updateError } = await supabase
                .from('products')
                .update({ images: cleanImages })
                .eq('id', p.id);

            if (updateError) {
                console.error('  X Update failed:', updateError.message);
            } else {
                console.log('  ✓ Updated.');
                updateCount++;
            }
        }
    }

    console.log(`\nCleanup complete. Updated ${updateCount} products.`);
}

cleanupGsmArenaImages();
