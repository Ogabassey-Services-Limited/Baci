import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkGaming() {
    // Get all gaming products
    const { data: all } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .eq('category', 'Video Games');

    console.log(`Total Video Games: ${all?.length || 0}`);

    const withImages = all?.filter(p => p.images && p.images.length > 0) || [];
    const withoutImages = all?.filter(p => !p.images || p.images.length === 0) || [];

    console.log(`\n✅ With Images: ${withImages.length}`);
    console.log(`❌ Without Images: ${withoutImages.length}`);

    if (withoutImages.length > 0) {
        console.log('\n--- Products Missing Images ---');
        withoutImages.forEach(p => console.log(`- ${p.name} (slug: ${p.slug})`));
    }

    // Check the 5 known mismatches
    console.log('\n--- Known Mismatches (checking slugs) ---');
    const mismatches = [
        'assassins-creed-mirage',
        'ghost-of-tsushima-directors-cut',
        'god-of-war-ragnarok',
        'marvels-spider-man-2',
        'resident-evil-4'
    ];

    for (const slug of mismatches) {
        const { data } = await supabase
            .from('products')
            .select('id, name, slug')
            .ilike('slug', `%${slug.replace(/-/g, '%')}%`)
            .limit(3);

        console.log(`\nSearching for '${slug}':`);
        if (data && data.length > 0) {
            data.forEach(p => console.log(`   Found: ${p.name} (slug: ${p.slug})`));
        } else {
            console.log('   Not found');
        }
    }
}

checkGaming();
