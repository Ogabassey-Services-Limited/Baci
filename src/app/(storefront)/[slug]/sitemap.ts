import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { generateSlug } from '@/lib/seo-utils'

// Initialize Supabase client for public data access
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

    // 2. Fetch products for this merchant (include category for URL building)
    const { data: products } = await supabase
        .from('products')
        .select('id, slug, category, updated_at')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active');

    // 3. Get unique categories for category pages
    const categories = [...new Set((products || []).map(p => p.category).filter(Boolean))];

    const headersList = await headers();
    const host = headersList.get('host') || `${slug}.localhost:3000`;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const storeUrl = `${protocol}://${host}`;

    // Build product URLs with category when available
    // Format: /{category}/{product-slug} or /products/{product-slug}
    const productEntries: MetadataRoute.Sitemap = (products || []).map((product) => {
        const productSlug = product.slug || product.id;
        const url = product.category
            ? `${storeUrl}/${generateSlug(product.category)}/${productSlug}`
            : `${storeUrl}/products/${productSlug}`;

        return {
            url,
            lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        };
    });

    // Build category page URLs
    const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
        url: `${storeUrl}/${generateSlug(category as string)}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
    }));

    return [
        {
            url: storeUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        ...categoryEntries,
        ...productEntries,
    ];
}
