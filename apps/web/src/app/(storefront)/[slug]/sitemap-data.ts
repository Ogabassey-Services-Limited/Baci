import type { PostgrestError } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import {
  getCachedCategoryPageData,
  getCachedFeatureSettings,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { escapeHtml } from '@/lib/sanitize-core';
import { getProductUrl } from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { buildCategorySupportLinks } from '@/lib/storefront-compare/build-commercial-support-links';
import {
  resolveMerchantContextIdentifier,
  resolveRouteIdentifier,
} from '@/lib/storefront-route-identifier';
import {
  buildMerchantTrustProfile,
  hasPublishableReturnsPolicy,
  hasPublishableShippingPolicy,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';
import { createAnonClient } from '@/lib/supabase/anon';

export interface ProductWithCategory {
  id: string;
  slug: string | null;
  category: string | null;
  canonical_url: string | null;
  images: Array<string | { url: string }> | null;
  updated_at: string | null;
  category_id: string | null;
  categories: { slug: string | null } | null;
}

interface BlogPostSitemapRow {
  slug: string;
  published_at: string | null;
  updated_at: string | null;
  featured_image_url: string | null;
}

const SITEMAP_QUERY_PAGE_SIZE = 1000;
// Sitemap spec caps a single file at 50,000 URLs. Leave headroom so combined
// static/category/commercial URLs plus product URLs stay comfortably under the
// limit in getRootSitemapEntries.
const SITEMAP_MAX_PRODUCT_URLS = 45_000;
export interface StorefrontSitemapContext {
  merchant: NonNullable<Awaited<ReturnType<typeof getMerchantByIdentifier>>>;
  storeUrl: string;
  supabase: ReturnType<typeof createAnonClient>;
}

export async function resolveStorefrontSitemapContext(
  headersList: Headers,
  routeIdentifierOverride?: string | null,
  request?: Request
): Promise<StorefrontSitemapContext | null> {
  const rawIdentifiers: string[] = [];
  const requestHeaders = request ? new Headers(request.headers) : null;

  // 1. Request headers (proxy headers set by middleware)
  if (requestHeaders) {
    try {
      const requestRouteIdentifier =
        resolveMerchantContextIdentifier(requestHeaders);
      if (requestRouteIdentifier) {
        rawIdentifiers.push(requestRouteIdentifier);
      }
    } catch {
      // ignore
    }
  }

  // 2. Request host
  let requestHostname: string | null = null;
  if (request) {
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();
      requestHostname = host;
      const normalizedHost = host.replace(/^www\./, '');
      const rootDomain = (
        process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
      ).toLowerCase();

      if (
        normalizedHost !== 'localhost' &&
        normalizedHost !== '127.0.0.1' &&
        normalizedHost !== rootDomain
      ) {
        if (normalizedHost.endsWith(`.${rootDomain}`)) {
          const sub = normalizedHost.slice(0, -(rootDomain.length + 1));
          if (sub) rawIdentifiers.push(sub);
        } else {
          rawIdentifiers.push(normalizedHost);
          if (host.startsWith('www.')) {
            rawIdentifiers.push(host);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Next.js headers
  const headerRouteIdentifier = resolveRouteIdentifier(headersList);
  if (headerRouteIdentifier) {
    rawIdentifiers.push(headerRouteIdentifier);
  }

  // 4. Route params override
  const routeIdentifierOverrideValue =
    routeIdentifierOverride?.trim().toLowerCase() || '';
  if (routeIdentifierOverrideValue) {
    rawIdentifiers.push(routeIdentifierOverrideValue);
  }

  const routeIdentifiers = rawIdentifiers.filter(
    (value, index, values): value is string =>
      Boolean(value && values.indexOf(value) === index)
  );

  let merchant = null;
  for (const routeIdentifier of routeIdentifiers) {
    try {
      merchant = await getMerchantByIdentifier(routeIdentifier);
    } catch (error) {
      console.warn('Failed to resolve sitemap merchant', {
        routeIdentifier,
        error,
      });
      continue;
    }

    if (merchant) {
      break;
    }
  }

  if (!merchant) {
    const SAFE_LOG_HEADERS = [
      'host',
      'x-forwarded-host',
      'x-merchant-slug',
      'x-custom-domain',
      'x-merchant-domain',
    ];
    const safeHeaders = request
      ? Object.fromEntries(
          [...request.headers.entries()].filter(([k]) =>
            SAFE_LOG_HEADERS.includes(k.toLowerCase())
          )
        )
      : null;
    console.error('storefront sitemap: unresolved context', {
      candidates: rawIdentifiers,
      hosts: requestHostname ? [requestHostname] : [],
      safeHeaders,
    });
    return null;
  }

  const storeUrlHeaders = requestHeaders ?? headersList;

  return {
    merchant,
    storeUrl: buildRequestScopedStoreUrl(merchant, storeUrlHeaders),
    supabase: createAnonClient(),
  };
}

export function getStaticSitemapEntries(
  storeUrl: string
): MetadataRoute.Sitemap {
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
}

export function getTrustPolicySitemapEntries({
  merchant,
  storeUrl,
}: StorefrontSitemapContext): MetadataRoute.Sitemap {
  const trustProfile = buildMerchantTrustProfile(merchant, storeUrl);
  const trustUrls = [
    hasPublishableReturnsPolicy(trustProfile) ? `${storeUrl}/returns` : null,
    hasPublishableShippingPolicy(trustProfile) ? `${storeUrl}/shipping` : null,
    hasPublishableWarrantyPolicy(trustProfile) ? `${storeUrl}/warranty` : null,
  ].filter((url): url is string => typeof url === 'string' && url.length > 0);

  return trustUrls.map((url) => ({
    url,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.5,
  }));
}

export function getStaticAndTrustSitemapEntries(
  context: StorefrontSitemapContext
): MetadataRoute.Sitemap {
  return [
    ...getStaticSitemapEntries(context.storeUrl),
    ...getTrustPolicySitemapEntries(context),
  ];
}

export async function getProductSitemapEntries({
  supabase,
  merchant,
  storeUrl,
}: StorefrontSitemapContext): Promise<MetadataRoute.Sitemap> {
  const products: ProductWithCategory[] = [];
  let from = 0;

  while (products.length < SITEMAP_MAX_PRODUCT_URLS) {
    const remaining = SITEMAP_MAX_PRODUCT_URLS - products.length;
    const pageSize = Math.min(SITEMAP_QUERY_PAGE_SIZE, remaining);
    const { data, error } = (await supabase
      .from('products')
      .select(
        'id, slug, category, canonical_url, images, updated_at, category_id, categories:category_id(slug)'
      )
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)) as {
      data: ProductWithCategory[] | null;
      error: PostgrestError | null;
    };

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    products.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  if (products.length === 0) {
    return [];
  }

  return products.map((product) => {
    const normalizedJoinedCategory =
      product.categories?.slug && product.categories.slug.trim().length > 0
        ? { slug: product.categories.slug.trim() }
        : null;

    const url = `${storeUrl}${getProductUrl({
      id: product.id,
      slug: product.slug ?? undefined,
      name: product.slug || product.id,
      category: product.category,
      categories: normalizedJoinedCategory,
      canonical_url: product.canonical_url,
    })}`;

    const images: string[] = [];
    if (Array.isArray(product.images)) {
      product.images.forEach((img: unknown) => {
        const url =
          typeof img === 'string' ? img : (img as Record<string, unknown>)?.url;
        if (typeof url === 'string' && url.startsWith('http')) {
          images.push(url);
        }
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

export async function getCategorySitemapEntries({
  supabase,
  merchant,
  storeUrl,
}: StorefrontSitemapContext): Promise<MetadataRoute.Sitemap> {
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

export async function getBlogSitemapEntries({
  supabase,
  merchant,
  storeUrl,
}: StorefrontSitemapContext): Promise<MetadataRoute.Sitemap> {
  // Mirror the blog feature-flag guard used in getCachedBlogListing /
  // getCachedBlogPost and the dedicated /blog/sitemap.xml so storefronts
  // without the blog enabled never expose /blog URLs in the root sitemap
  // (those routes short-circuit to 404 when the feature is off).
  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) {
    return [];
  }

  const { data: posts, error } = (await supabase
    .from('blog_posts')
    .select('slug, published_at, updated_at, featured_image_url')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .not('published_at', 'is', null)) as {
    data: BlogPostSitemapRow[] | null;
    error: PostgrestError | null;
  };

  if (error) {
    throw error;
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${storeUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  for (const post of posts || []) {
    const lastModified = post.updated_at || post.published_at;
    if (!lastModified) {
      continue;
    }

    entries.push({
      url: `${storeUrl}/blog/${post.slug}`,
      lastModified: new Date(lastModified),
      changeFrequency: 'monthly',
      priority: 0.8,
      ...(post.featured_image_url?.startsWith('http') && {
        images: [post.featured_image_url],
      }),
    });
  }

  return entries;
}

export async function getCommercialSupportSitemapEntries(
  context: StorefrontSitemapContext
): Promise<MetadataRoute.Sitemap> {
  const categoryEntries = await getCategorySitemapEntries(context);
  const commercialEntries = await Promise.all(
    categoryEntries.map(async (entry) => {
      const categorySlug = entry.url.replace(`${context.storeUrl}/`, '');
      const categoryData = await getCachedCategoryPageData(
        context.merchant.id,
        categorySlug,
        context.merchant.slug
      );

      if (!categoryData || categoryData.isCollection) {
        return [];
      }

      const links = buildCategorySupportLinks({
        storeUrl: context.storeUrl,
        categorySlug,
        categoryName: categoryData.fallbackName || categorySlug,
        products: (categoryData.products ?? []).map((product) => {
          const candidate = product as {
            slug: string;
            name: string;
            brand?: string | null;
            price: number;
            category_slug?: string | null;
            product_key_specs?: Record<string, unknown> | null;
          };

          return {
            slug: candidate.slug,
            name: candidate.name,
            brand: candidate.brand,
            price: candidate.price,
            category_slug: candidate.category_slug,
            product_key_specs: candidate.product_key_specs,
          };
        }),
      });

      return links.map((link) => ({
        url: link.href,
        lastModified:
          entry.lastModified instanceof Date ? entry.lastModified : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    })
  );

  return commercialEntries.flat();
}

export async function getRootSitemapEntries(
  context: StorefrontSitemapContext
): Promise<MetadataRoute.Sitemap> {
  const getSafeSitemapEntries = async (
    label: string,
    loader: () => Promise<MetadataRoute.Sitemap>
  ): Promise<MetadataRoute.Sitemap> => {
    try {
      return await loader();
    } catch (error) {
      console.warn(`storefront sitemap: ${label} entries unavailable`, {
        error,
      });
      return [];
    }
  };

  const [
    staticEntries,
    productEntries,
    categoryEntries,
    blogEntries,
    commercialSupportEntries,
  ] = await Promise.all([
    Promise.resolve(getStaticAndTrustSitemapEntries(context)),
    getSafeSitemapEntries('products', () => getProductSitemapEntries(context)),
    getSafeSitemapEntries('categories', () =>
      getCategorySitemapEntries(context)
    ),
    getSafeSitemapEntries('blog', () => getBlogSitemapEntries(context)),
    getSafeSitemapEntries('commercial-support', () =>
      getCommercialSupportSitemapEntries(context)
    ),
  ]);

  return [
    ...staticEntries,
    ...productEntries,
    ...categoryEntries,
    ...blogEntries,
    ...commercialSupportEntries,
  ];
}

export function getNamedSitemapEntries(
  context: StorefrontSitemapContext,
  id: string
): MetadataRoute.Sitemap | Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 'root':
      return getRootSitemapEntries(context);
    case 'static':
      return getStaticAndTrustSitemapEntries(context);
    case 'products':
      return getProductSitemapEntries(context);
    case 'categories':
      return getCategorySitemapEntries(context);
    case 'commercial-support':
      return getCommercialSupportSitemapEntries(context);
    default:
      return [];
  }
}

export function serializeSitemap(entries: MetadataRoute.Sitemap): string {
  const hasImages = entries.some(
    (entry) => Array.isArray(entry.images) && entry.images.length > 0
  );
  const imageNamespace = hasImages
    ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : '';

  const body = entries
    .map((entry) => {
      const lastModified =
        typeof entry.lastModified === 'string'
          ? entry.lastModified
          : entry.lastModified?.toISOString();
      const images = (entry.images || [])
        .map(
          (image) =>
            `<image:image><image:loc>${escapeHtml(image)}</image:loc></image:image>`
        )
        .join('');

      return (
        '<url>' +
        `<loc>${escapeHtml(entry.url)}</loc>` +
        (lastModified ? `<lastmod>${lastModified}</lastmod>` : '') +
        (entry.changeFrequency
          ? `<changefreq>${entry.changeFrequency}</changefreq>`
          : '') +
        (typeof entry.priority === 'number'
          ? `<priority>${entry.priority}</priority>`
          : '') +
        images +
        '</url>'
      );
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNamespace}>${body}</urlset>`
  );
}

export function createSitemapResponse(
  entries: MetadataRoute.Sitemap
): Response {
  return new Response(serializeSitemap(entries), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

export function createSitemapUnavailableResponse(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
    {
      status: 503,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '300',
      },
    }
  );
}
