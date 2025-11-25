import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with admin/service role if possible, or anon key
// Since this is server-side generation, we can use the anon key for public data
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Props = {
    params: Promise<{ slug: string }>
}

export default async function sitemap({ params }: Props): Promise<MetadataRoute.Sitemap> {
    const { slug } = await params;

    // 1. Get Merchant ID from store slug
    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', slug)
        .single();

    if (!merchant) {
        return [];
    }

    // 2. Fetch products for this merchant
    const { data: products } = await supabase
        .from('products')
        .select('id, slug, updated_at')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active');

    const headersList = await headers();
    const host = headersList.get('host') || `${slug}.localhost:3000`;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const storeUrl = `${protocol}://${host}`;

    const productEntries: MetadataRoute.Sitemap = (products || []).map((product) => ({
        url: `${storeUrl}/products/${product.slug || product.id}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
    }));

    return [
        {
            url: storeUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        ...productEntries,
    ]
}
