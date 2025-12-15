import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CDN_BASE = 'https://cdn.ogabassey.com/products/';

async function verify() {
    console.log('🔍 Verifying deployment...');

    // 1. Check for products with updated images (containing CDN URL)
    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .ilike('name', '%macbook%')
        .not('images', 'is', null)
        .limit(5);

    if (products && products.length > 0) {
        console.log('\n💻 Verified MacBook Matches (Phase 2):');
        products.forEach(p => {
            console.log(`- ${p.name}`);
            console.log(`  Image: ${p.images?.[0]}`);
        });
    }

    // Fallback query if contains doesn't work well for string array substring match
    // We'll just fetch recently updated ones or check known IDs if we had them.
    // Let's just fetch ANY products with non-empty images and filter in code for safety.

    const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .not('images', 'is', null)
        .limit(100);

    if (!allProducts) {
        console.error('❌ No products found.');
        return;
    }

    const updated = allProducts.filter(p =>
        Array.isArray(p.images) &&
        p.images.some((url: string) => url.includes('cdn.ogabassey.com/products/'))
    );

    console.log(`\n📊 Found ${updated.length} updated products in sample of 100.`);

    if (updated.length > 0) {
        console.log('\n✅ Sample updated products:');
        updated.slice(0, 3).forEach(p => {
            console.log(`- ${p.name}`);
            console.log(`  Slug: ${p.slug}`);
            console.log(`  Image: ${p.images[0]}`);
        });
    } else {
        console.warn('⚠️ No products found with new CDN URLs in sample.');
    }
}

verify();
