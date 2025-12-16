
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simplified slug generator from lib/seo-utils.ts
function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function previewSitemap() {
    const slug = 'ogabassey';
    const protocol = 'https';
    const host = 'ogabassey.com'; // Assuming production host
    const storeUrl = `${protocol}://${host}`;

    console.log(`🔍 Generating sitemap preview for: ${storeUrl}\n`);

    // 1. Get Merchant
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', slug)
        .single();

    if (merchantError || !merchant) {
        console.error('❌ Failed to fetch merchant:', merchantError);
        return;
    }

    // 2. Fetch Products
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, slug, category, updated_at')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .limit(20); // Limit to 20 for preview

    if (prodError) {
        console.error('❌ Failed to fetch products:', prodError);
        return;
    }

    console.log('--- Standard Sitemap Links (Preview Top 20) ---');
    console.log(`${storeUrl}/`); // Home

    // Categories
    const categories = [...new Set((products || []).map(p => p.category).filter(Boolean))];
    categories.forEach(cat => {
        console.log(`${storeUrl}/${generateSlug(cat)}`);
    });

    // Products
    products?.forEach(p => {
        const productSlug = p.slug || p.id;
        const url = p.category
            ? `${storeUrl}/${generateSlug(p.category)}/${productSlug}`
            : `${storeUrl}/products/${productSlug}`;
        console.log(url);
    });

    console.log('\nTotal Products Found (in this batch):', products?.length);
    console.log('\n--- Image Sitemap ---');
    console.log('⚠️  The current sitemap implementation does NOT output image metadata.');
    console.log('   To add images, the sitemap.ts file needs to be updated to fetch and include image URLs.');

}

previewSitemap();
