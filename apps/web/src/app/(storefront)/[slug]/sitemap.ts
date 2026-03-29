import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { generateSlug } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { resolveRouteIdentifier } from '@/lib/storefront-route-identifier';
import { createAnonClient } from '@/lib/supabase/anon';

// headers() opts into dynamic rendering — revalidate is incompatible.
export const dynamic = 'force-dynamic';

interface ProductWithCategory {
  id: string;
  slug: string | null;
  category: string | null;
  images: Array<string | { url: string }> | null;
  updated_at: string | null;
  category_id: string | null;
  categories: { slug: string | null } | null;
}

/**
 * 2026 Best Practice: Sitemap Indexing
 * Generates multiple specialized sitemaps for easier SEO reporting in Google Search Console.
 */
export function generateSitemaps() {
  // Blog has its own dedicated sitemap at /blog/sitemap.xml
  return [{ id: 'static' }, { id: 'products' }, { id: 'categories' }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  // Next.js 16 with generateSitemaps() only passes { id } — not params.
  // Read the merchant slug from proxy headers or fall back to the host header.
  const headersList = await headers();
  const routeIdentifier = resolveRouteIdentifier(headersList);
  const merchant = routeIdentifier
    ? await getMerchantByIdentifier(routeIdentifier)
    : null;

  if (!merchant) return [];
  const storeUrl = buildStoreUrl(merchant);
  const supabase = createAnonClient();

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
      const { data: products, error } = (await supabase
        .from('products')
        .select(
          'id, slug, category, images, updated_at, category_id, categories:category_id(slug)'
        )
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')) as {
        data: ProductWithCategory[] | null;
        error: Error | null;
      };

      if (error) {
        throw error;
      }

      if (!products) {
        throw new Error(`Failed to load products sitemap for ${merchant.id}`);
      }

      return products.map((product) => {
        const productSlug = product.slug || product.id;
        const catSlug =
          product.categories?.slug ||
          (product.category ? generateSlug(product.category) : null);
        const url = catSlug
          ? `${storeUrl}/${catSlug}/${productSlug}`
          : `${storeUrl}/products/${productSlug}`;

        const images: string[] = [];
        if (Array.isArray(product.images)) {
          product.images.forEach((img: unknown) => {
            const url =
              typeof img === 'string'
                ? img
                : (img as Record<string, unknown>)?.url;
            if (typeof url === 'string' && url.startsWith('http'))
              images.push(url);
          });
        }

        return {
          url,
          lastModified: product.updated_at
            ? new Date(product.updated_at)
            : undefined,
          changeFrequency: 'weekly',
          priority: 0.8,
          ...(images.length > 0 && { images }),
        };
      });
    }

    case 'categories': {
      const { data: categories, error } = await supabase
        .from('categories')
        .select('slug, updated_at')
        .eq('merchant_id', merchant.id);

      if (error) {
        throw error;
      }

      if (!categories) {
        throw new Error(`Failed to load category sitemap for ${merchant.id}`);
      }

      return categories.map((cat) => ({
        url: `${storeUrl}/${cat.slug}`,
        lastModified: cat.updated_at ? new Date(cat.updated_at) : new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      }));
    }

    default:
      return [];
  }
}
