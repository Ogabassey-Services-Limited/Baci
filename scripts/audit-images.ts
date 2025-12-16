
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function auditImages() {
    console.log('📸 Auditing Product Images...');

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .eq('status', 'active');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    // const missingImage = []; // This array is no longer needed
    const emptyImagesArray = [];
    const placeholderImages = [];

    for (const p of products) {
        // Check images array (main source)
        if (!p.images || !Array.isArray(p.images) || p.images.length === 0) {
            emptyImagesArray.push(p);
        } else {
            // Check first image for placeholder
            const mainImage = p.images[0];
            if (mainImage && (mainImage.includes('placeholder') || mainImage.includes('default'))) {
                placeholderImages.push(p);
            }
        }
    }

    console.log(`\n🔍 Audit Results (${products.length} products scanned):`);
    // console.log(`   ❌ Missing Main Image: ${missingImage.length}`); // Removed
    console.log(`   ⚠️ Placeholder Image: ${placeholderImages.length}`);
    console.log(`   📂 Empty Gallery: ${emptyImagesArray.length}`);

    if (emptyImagesArray.length > 0) {
        console.log('\n--- Missing Images (Empty) ---');
        emptyImagesArray.forEach(p => console.log(`[${p.id}] ${p.name}`));
    }

    if (placeholderImages.length > 0) {
        console.log('\n--- Placeholder Images ---');
        placeholderImages.forEach(p => console.log(`[${p.id}] ${p.name} (${p.images[0]})`));
    }
}

auditImages();
