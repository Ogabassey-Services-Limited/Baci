
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function investigateTV() {
    // Find the TV product
    const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, images, description, category')
        .ilike('name', '%77%samsung%oled%')
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('=== PRODUCT DATA ===\n');

    if (data && data.length > 0) {
        data.forEach(p => {
            console.log(`Name: ${p.name}`);
            console.log(`Slug: ${p.slug}`);
            console.log(`Category: ${p.category}`);
            console.log(`Images: ${p.images && p.images.length > 0 ? p.images[0] : 'MISSING'}`);
            console.log(`Images Array: ${p.images ? JSON.stringify(p.images) : 'EMPTY'}`);
            console.log(`\nDescription (first 500 chars):\n${p.description?.substring(0, 500)}`);
            console.log('\n---');
        });
    } else {
        console.log('No matching products found');
    }

    // Also check how many Samsung TVs are missing images
    const { data: tvs } = await supabase
        .from('products')
        .select('id, name, images')
        .ilike('category', '%samsung%tv%');

    const missing = tvs?.filter(t => !t.images || t.images.length === 0) || [];
    console.log(`\n=== SAMSUNG TV IMAGE STATS ===`);
    console.log(`Total Samsung TVs: ${tvs?.length || 0}`);
    console.log(`Missing Images: ${missing.length}`);
    if (missing.length > 0) {
        console.log('\nMissing image products:');
        missing.forEach(m => console.log(`  - ${m.name}`));
    }
}

investigateTV();
