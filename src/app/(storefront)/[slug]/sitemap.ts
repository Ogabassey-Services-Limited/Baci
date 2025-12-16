import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { generateSlug } from '@/lib/seo-utils';

// Initialize Supabase client for public data access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Storefront Sitemap Generator with Image Support
 * Uses x-merchant-slug header set by proxy.ts middleware
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();

  // Get slug from middleware header or extract from host
  const slug =
    headersList.get('x-merchant-slug') ||
    headersList.get('x-custom-domain')?.replace('.com', '').replace('.', '-') ||
    'ogabassey'; // fallback

  const host = headersList.get('host') || `${slug}.localhost:3000`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const storeUrl = `${protocol}://${host}`;

  // 1. Get Merchant ID from store slug
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!merchant) {
    return [];
  }

  // 2. Fetch products with images
  const { data: products } = await supabase
    .from('products')
    .select('id, slug, name, category, images, updated_at')
    .eq('merchant_id', merchant.id)
    .eq('status', 'active');

  // 3. Get unique categories
  const categories = [
    ...new Set((products || []).map((p) => p.category).filter(Boolean)),
  ];

  // Product entries with images
  const productEntries: MetadataRoute.Sitemap = (products || []).map(
    (product) => {
      const productSlug = product.slug || product.id;
      const url = product.category
        ? `${storeUrl}/${generateSlug(product.category)}/${productSlug}`
        : `${storeUrl}/products/${productSlug}`;

      // Extract image URLs as simple string array (Next.js format)
      const images: string[] = [];
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((imageUrl: string) => {
          if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
            images.push(imageUrl);
          }
        });
      }

      return {
        url,
        lastModified: product.updated_at
          ? new Date(product.updated_at)
          : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        ...(images.length > 0 && { images }),
      };
    }
  );

  // Category entries
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
