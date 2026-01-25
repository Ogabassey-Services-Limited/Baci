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

export const revalidate = 21600; // Cache sitemap for 6 hours

/**
 * 2026 Best Practice: Sitemap Indexing
 * Generates multiple specialized sitemaps for easier SEO reporting in Google Search Console.
 */
export async function generateSitemaps() {
  // Fetch merchant list is not needed here because this is already in the (storefront)/[slug] layout.
  // We specify the IDs of the sitemaps we want to generate.
  return [{ id: 'static' }, { id: 'products' }, { id: 'categories' }, { id: 'blog' }];
}

export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();

  const slug =
    headersList.get('x-merchant-slug') ||
    headersList.get('x-custom-domain')?.replace('.com', '').replace('.', '-') ||
    'ogabassey'; // fallback

  const host = headersList.get('host') || `${slug}.localhost:3000`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const storeUrl = `${protocol}://${host}`;

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!merchant) return [];

  switch (id) {
    case 'static':
      return [
        {
          url: storeUrl,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 1,
        },
        {
          url: `${storeUrl}/faq`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.5,
        },
      ];

    case 'products': {
      const { data: products } = await supabase
        .from('products')
        .select('id, slug, category, images, updated_at, category_id, categories:category_id(slug)')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active');

      return (products || []).map((product) => {
        const productSlug = product.slug || product.id;
        const catSlug = product.categories?.slug || (product.category ? generateSlug(product.category) : null);
        const url = catSlug ? `${storeUrl}/${catSlug}/${productSlug}` : `${storeUrl}/products/${productSlug}`;

        const images: string[] = [];
        if (Array.isArray(product.images)) {
          product.images.forEach((img: any) => {
            const url = typeof img === 'string' ? img : img?.url;
            if (url?.startsWith('http')) images.push(url);
          });
        }

        return {
          url,
          lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
          changeFrequency: 'weekly',
          priority: 0.8,
          ...(images.length > 0 && { images }),
        };
      });
    }

    case 'categories': {
      const { data: categories } = await supabase
        .from('categories')
        .select('slug, updated_at')
        .eq('merchant_id', merchant.id);

      return (categories || []).map((cat: any) => ({
        url: `${storeUrl}/${cat.slug}`,
        lastModified: cat.updated_at ? new Date(cat.updated_at) : new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      }));
    }

    case 'blog': {
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('slug, published_at, updated_at, featured_image_url')
        .eq('merchant_id', merchant.id)
        .eq('status', 'published');

      const entries = (posts || []).map((post) => ({
        url: `${storeUrl}/blog/${post.slug}`,
        lastModified: post.updated_at ? new Date(post.updated_at) : new Date(post.published_at || Date.now()),
        changeFrequency: 'monthly',
        priority: 0.8,
        ...(post.featured_image_url?.startsWith('http') && { images: [post.featured_image_url] }),
      }));

      if (entries.length > 0) {
        entries.unshift({
          url: `${storeUrl}/blog`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.7,
        } as any);
      }
      return entries;
    }

    default:
      return [];
  }
}
