import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function populateCategoryImages() {
    console.log('🚀 Starting Category Image Population...');

    // 1. Get all categories
    const { data: categories } = await supabase.from('categories').select('id, name, slug, image_url, merchant_id, parent_id');

    if (!categories) return;
    console.log(`📂 Found ${categories.length} categories.`);

    let updatedCount = 0;

    for (const cat of categories) {
        if (cat.image_url) {
            console.log(`   ✅ ${cat.name} already has image.`);
            continue;
        }

        // 2. Find best product for this category
        // Logic: Active, has images, sort by price desc (high value item = good hero image)
        let query = supabase
            .from('products')
            .select('name, images, price')
            .eq('status', 'active')
            .not('images', 'is', null)
            .order('price', { ascending: false })
            .limit(1);

        // Filter by exact category string if possible, or name match
        // Note: products table uses 'category' string column, not relation ID usually in this schema
        query = query.eq('category', cat.name);

        let { data: products } = await query;
        let validImage = null;

        if (products && products.length > 0 && products[0].images && products[0].images.length > 0) {
            validImage = products[0].images[0];
            console.log(`   📸 Found image for [${cat.name}]: ${products[0].name} ($${products[0].price})`);
        } else {
            // Fallback 1: Try regex/ilike on CATEGORY field
            let { data: fallback } = await supabase
                .from('products')
                .select('name, images')
                .ilike('category', `%${cat.name}%`)
                .not('images', 'is', null)
                .order('price', { ascending: false })
                .limit(1);

            // Fallback 2: Try regex/ilike on PRODUCT NAME (Crucial for "MacBook", "Infinix")
            if (!fallback || fallback.length === 0) {
                const { data: nameFallback } = await supabase
                    .from('products')
                    .select('name, images')
                    .ilike('name', `%${cat.name}%`)
                    .not('images', 'is', null)
                    .order('price', { ascending: false })
                    .limit(1);
                fallback = nameFallback;
            }

            if (fallback && fallback.length > 0 && fallback[0].images && fallback[0].images.length > 0) {
                validImage = fallback[0].images[0];
                console.log(`   🔄 Fallback image for [${cat.name}]: ${fallback[0].name}`);
            }
        }

        if (validImage) {
            // 3. Update Category
            const { error } = await supabase
                .from('categories')
                .update({ image_url: validImage })
                .eq('id', cat.id);

            if (!error) {
                updatedCount++;
            } else {
                console.error(`   ❌ Failed to update ${cat.name}: ${error.message}`);
            }
        } else {
            console.log(`   ⚠️ No suitable image found for [${cat.name}]`);
        }
    }

    console.log(`\n🎉 Updated ${updatedCount} categories with images.`);
}

populateCategoryImages();
