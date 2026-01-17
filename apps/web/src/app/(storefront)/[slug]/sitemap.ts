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

  // 2. Fetch products with images and joined category data
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      slug,
      name,
      category,
      images,
      updated_at,
      category_id,
      categories:category_id(id, name, slug)
    `)
    .eq('merchant_id', merchant.id)
    .eq('status', 'active');

  // 3. Get unique categories from joined data and fallback to TEXT column
  interface ProductWithCategory {
    category?: string;
    categories?: { id: string; name: string; slug: string } | null;
  }

  const categoryMap = new Map<string, { name: string; slug: string }>();

  (products || []).forEach((p) => {
    const product = p as unknown as ProductWithCategory;
    const joinedCategory = product.categories;

    if (joinedCategory) {
      // Use joined category data (preferred)
      categoryMap.set(joinedCategory.slug, {
        name: joinedCategory.name,
        slug: joinedCategory.slug,
      });
    } else if (product.category) {
      // Fallback to TEXT column
      const slug = generateSlug(product.category);
      if (!categoryMap.has(slug)) {
        categoryMap.set(slug, {
          name: product.category,
          slug: slug,
        });
      }
    }
  });

  const categories = Array.from(categoryMap.values());

  // Product entries with images
  const productEntries: MetadataRoute.Sitemap = (products || []).map(
    (product) => {
      const productWithCat = product as unknown as ProductWithCategory;
      const joinedCategory = productWithCat.categories;

      const productSlug = product.slug || product.id;

      // Use joined category slug if available, fallback to TEXT column
      let categorySlug: string | null = null;
      if (joinedCategory?.slug) {
        categorySlug = joinedCategory.slug;
      } else if (product.category) {
        categorySlug = generateSlug(product.category);
      }

      const url = categorySlug
        ? `${storeUrl}/${categorySlug}/${productSlug}`
        : `${storeUrl}/products/${productSlug}`;

      // Extract image URLs as simple string array (Next.js format)
      const images: string[] = [];
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((imageItem: string | { url: string }) => {
          if (typeof imageItem === 'string' && imageItem.startsWith('http')) {
            images.push(imageItem);
          } else if (
            typeof imageItem === 'object' &&
            imageItem?.url &&
            imageItem.url.startsWith('http')
          ) {
            images.push(imageItem.url);
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
    url: `${storeUrl}/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // 4. Fetch blog posts with featured images for blog sitemap
  const { data: blogPosts } = await supabase
    .from('blog_posts')
    .select('slug, published_at, updated_at, featured_image_url')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  // Blog post entries with images (for Google Images indexing)
  const blogEntries: MetadataRoute.Sitemap = (blogPosts || []).map((post) => {
    const images: string[] = [];
    if (post.featured_image_url?.startsWith('http')) {
      images.push(post.featured_image_url);
    }

    return {
      url: `${storeUrl}/blog/${post.slug}`,
      lastModified: post.updated_at
        ? new Date(post.updated_at)
        : post.published_at
          ? new Date(post.published_at)
          : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      ...(images.length > 0 && { images }),
    };
  });

  // Blog listing page entry
  const blogListingEntry: MetadataRoute.Sitemap[0] = {
    url: `${storeUrl}/blog`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  };

  // FAQ page entry (if merchant has FAQ content)
  const faqEntry: MetadataRoute.Sitemap[0] = {
    url: `${storeUrl}/faq`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  };

  return [
    {
      url: storeUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    faqEntry,
    ...categoryEntries,
    ...productEntries,
    // Only include blog entries if there are blog posts
    ...(blogPosts && blogPosts.length > 0
      ? [blogListingEntry, ...blogEntries]
      : []),
  ];
}
