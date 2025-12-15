import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
    // 1. Products without images
    const { data: all, error: productsError } = await supabase.from('products').select('id, name, images');
    if (productsError) {
        console.error('❌ Failed to fetch products:', productsError.message);
        return;
    }
    const noImages = all?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];

    console.log('📊 PRODUCTS WITHOUT IMAGES:', noImages.length, '/', all?.length);
    console.log('\nSample products without images:');
    noImages.slice(0, 15).forEach(p => console.log('  -', p.name));

    // 2. Categories
    const { data: cats, error: catsError } = await supabase.from('categories').select('id, name, slug, image_url, parent_id');
    if (catsError) {
        console.error('❌ Failed to fetch categories:', catsError.message);
        return;
    }
    console.log('\n📂 TOTAL CATEGORIES:', cats?.length);

    const noCatImage = cats?.filter(c => !c.image_url) || [];
    console.log('Categories without image_url:', noCatImage.length);

    // Show all categories
    console.log('\nAll Categories:');
    cats?.forEach(c => {
        const hasImage = c.image_url ? '✅' : '❌';
        const parent = c.parent_id ? '  (sub)' : '';
        console.log(`  ${hasImage} ${c.name} [${c.slug}]${parent}`);
    });
}

audit().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
