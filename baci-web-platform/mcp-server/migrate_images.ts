
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load from root .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('FATAL: Missing env vars');
    console.log('Current directory:', process.cwd());
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateImages() {
    console.log('Fetching products...');

    // Fetch only necessary fields
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, images');

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    if (!products || products.length === 0) {
        console.log('No products found.');
        return;
    }

    console.log(`Found ${products.length} products.`);

    let updatedCount = 0;
    const CHUNK_SIZE = 50;

    // Helper function to process single product
    const processProduct = async (product: any) => {
        if (!product.images || !Array.isArray(product.images) || product.images.length === 0) return false;

        let modified = false;
        const newImages = product.images.map((img: any) => {
            let url = String(img);

            // Fix Path
            if (url.includes('cdn.ogabassey.com/products/') && !url.includes('core-assets')) {
                url = url.replace('cdn.ogabassey.com/products/', 'cdn.ogabassey.com/core-assets/products/');
                modified = true;
            }

            // Fix Extension
            if (url.endsWith('.avif')) {
                url = url.replace('.avif', '.jpg');
                modified = true;
            }

            return url;
        });

        if (modified) {
            const { error: updateError } = await supabase
                .from('products')
                .update({ images: newImages })
                .eq('id', product.id);

            if (updateError) {
                console.error(`Failed to update ${product.id}:`, updateError.message);
                return false;
            }
            return true;
        }
        return false;
    };

    // Process in batches
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
        const chunk = products.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(chunk.map(processProduct));
        const chunkUpdated = results.filter(r => r).length;
        updatedCount += chunkUpdated;
        console.log(`Processed ${Math.min(i + CHUNK_SIZE, products.length)}/${products.length} (Updated: ${chunkUpdated})`);
    }

    console.log(`Migration complete. Updated ${updatedCount} products.`);
}

migrateImages().catch(console.error);
