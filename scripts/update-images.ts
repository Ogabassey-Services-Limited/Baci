
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UPDATES = [
    {
        matcher: 'HP OMEN MAX',
        imageUrl: 'https://cdn.ogabassey.com/products/23ca4be9-acdc-476f-899d-1259cb0e67bc.png',
        comment: 'Sourced from internal donor HP OMEN 16-AN0119'
    },
    {
        matcher: 'SAMSUNG OLED DISPLAY SMART TV',
        imageUrl: 'https://images-na.ssl-images-amazon.com/images/P/B0C81SJX5D.01.LZZZZZZZ.jpg',
        comment: 'Sourced from Amazon ASIN B0C81SJX5D (Samsung 83 S90C)'
    }
];

async function main() {
    console.log('🖼️ Updating Missing Images...');

    for (const update of UPDATES) {
        // Find products matching the matcher AND missing images
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, images')
            .eq('status', 'active')
            .ilike('name', `%${update.matcher}%`);

        if (error) {
            console.error(`Error searching for ${update.matcher}:`, error);
            continue;
        }

        const missingImages = products.filter(p => !p.images || !Array.isArray(p.images) || p.images.length === 0);

        if (missingImages.length === 0) {
            console.log(`  - No missing image products found for "${update.matcher}"`);
            continue;
        }

        console.log(`  - Found ${missingImages.length} matches for "${update.matcher}" (Source: ${update.comment})`);

        for (const p of missingImages) {
            // Update the product
            const { error: updateError } = await supabase
                .from('products')
                .update({
                    images: [update.imageUrl]
                })
                .eq('id', p.id);

            if (updateError) {
                console.error(`    ❌ Failed to update ${p.name}:`, updateError);
            } else {
                console.log(`    ✅ Updated: ${p.name}`);
            }
        }
    }
}

main();
