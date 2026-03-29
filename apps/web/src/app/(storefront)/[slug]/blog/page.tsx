import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import {
  getCachedFeatureSettings,
  getCachedMerchant,
  getCachedMerchantByDomain,
  getPublicSupabaseClient,
} from '@/lib/cached-data';
import { generateBreadcrumbSchema, generateSlug } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { isDomainIdentifier } from '@/lib/validation';
import { type BlogPostData, getTemplate } from '@/templates/registry';
import { DefaultBlogUi } from './default-blog-ui';
import { TemplateBlogRenderer } from './template-blog-renderer';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; page?: string; search?: string }>;
}

function parseBlogListingPage(page?: string): number {
  const parsedPage = Number.parseInt(String(page ?? '1'), 10);
  return Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
}

const getMerchantAndPosts = cache(
  async (
    identifier: string,
    category?: string,
    page = 1,
    searchQuery?: string
  ) => {
    const supabase = getPublicSupabaseClient();
    const limit = BLOG_LISTING_PAGE_SIZE;
    const offset = (page - 1) * limit;
    const lookupKey = identifier.toLowerCase();
    const cachedMerchant = isDomainIdentifier(identifier)
      ? await getCachedMerchantByDomain(lookupKey)
      : await getCachedMerchant(lookupKey);
    if (!cachedMerchant) return null;
    const merchant = {
      id: cachedMerchant.id,
      business_name: cachedMerchant.business_name,
      slug: cachedMerchant.slug,
      logo_url: cachedMerchant.logo_url,
      template_id: cachedMerchant.template_id,
      custom_domain: cachedMerchant.custom_domain,
    };
    const features = await getCachedFeatureSettings(merchant.id);
    if (!features?.blog_enabled) return null;
    let query = supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, tags, author_name, published_at, reading_time_minutes, view_count',
        { count: 'exact' }
      )
      .eq('merchant_id', merchant.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    if (searchQuery) {
      const sanitizedSearch = searchQuery.trim().slice(0, 100);
      if (sanitizedSearch) {
        query = query.textSearch('search_vector', sanitizedSearch, {
          type: 'websearch',
          config: 'english',
        });
      }
    }

    const { data: posts, count, error: postsError } = await query;
    if (postsError) {
      console.error('Failed to load blog posts', {
        merchantId: merchant.id,
        error: postsError,
      });
      throw postsError;
    }

    const { data: categories, error: categoriesError } = await supabase
      .from('blog_posts')
      .select('category')
      .eq('merchant_id', merchant.id)
      .eq('status', 'published')
      .not('category', 'is', null);
    if (categoriesError) {
      console.warn('Failed to load blog categories', {
        merchantId: merchant.id,
        error: categoriesError,
      });
    }

    const uniqueCategories = categoriesError
      ? []
      : [...new Set(categories?.map((c) => c.category).filter(Boolean))];

    return {
      merchant,
      posts: posts || [],
      totalPosts: count || 0,
      categories: uniqueCategories,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit),
      searchQuery,
    };
  }
);

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const currentPage = parseBlogListingPage(page);
  const data = await getMerchantAndPosts(slug, undefined, currentPage);
  if (!data) {
    return { title: 'Blog Not Found' };
  }
  const baseUrl = buildStoreUrl(data.merchant);
  const canonicalUrl =
    currentPage > 1 ? `${baseUrl}/blog?page=${currentPage}` : `${baseUrl}/blog`;
  const socialImageCandidates = [
    data.posts[0]?.featured_image_url,
    data.merchant.logo_url,
  ];
  const prevUrl =
    currentPage > 2
      ? `${baseUrl}/blog?page=${currentPage - 1}`
      : currentPage === 2
        ? `${baseUrl}/blog`
        : undefined;
  const nextUrl =
    currentPage < data.totalPages
      ? `${baseUrl}/blog?page=${currentPage + 1}`
      : undefined;

  return {
    title: `Blog | ${data.merchant.business_name}`,
    description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
    openGraph: {
      title: `Blog | ${data.merchant.business_name}`,
      description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
      type: 'website',
      url: canonicalUrl,
      siteName: data.merchant.business_name,
      images: getStorefrontOpenGraphImages(
        baseUrl,
        `${data.merchant.business_name} blog`,
        ...socialImageCandidates
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title: `Blog | ${data.merchant.business_name}`,
      description: `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
      images: getStorefrontTwitterImages(baseUrl, ...socialImageCandidates),
    },
    alternates: {
      canonical: canonicalUrl,
      types: {
        'application/rss+xml': `${baseUrl}/api/blog/feed/${slug}`,
      },
    },
    other: {
      ...(prevUrl ? { 'link-prev': prevUrl } : {}),
      ...(nextUrl ? { 'link-next': nextUrl } : {}),
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  };
}

export default async function BlogPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category, page, search } = await searchParams;
  const currentPage = parseBlogListingPage(page);
  const data = await getMerchantAndPosts(slug, category, currentPage, search);
  if (!data) {
    notFound();
  }
  const { merchant, posts, categories, totalPosts, searchQuery } = data;
  const baseUrl = buildStoreUrl(merchant);
  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${merchant.business_name} Blog`,
    description: `Read the latest articles, news, and insights from ${merchant.business_name}.`,
    url: `${baseUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      name: merchant.business_name,
      logo: merchant.logo_url
        ? {
            '@type': 'ImageObject',
            url: merchant.logo_url,
          }
        : undefined,
    },
    blogPost: posts.slice(0, 10).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt || '',
      url: `${baseUrl}/blog/${post.slug}`,
      datePublished: post.published_at,
      author: {
        '@type': 'Person',
        name: post.author_name || merchant.business_name,
      },
      image: post.featured_image_url || undefined,
    })),
  };
  const breadcrumbSchema = generateBreadcrumbSchema([
    {
      name: merchant.business_name,
      url: baseUrl,
    },
    {
      name: 'Blog',
      url: `${baseUrl}/blog`,
    },
  ]);
  const templateId = merchant.template_id;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Blog) {
          const BlogComponent = components.Blog;
          const templateCategories = categories.map((cat) => ({
            name: cat,
            slug: generateSlug(cat),
          }));
          const blogPosts: BlogPostData[] = posts.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt || '',
            category: p.category || '',
            author_name: p.author_name || merchant.business_name,
            published_at: p.published_at,
            featured_image_url: p.featured_image_url || '',
            reading_time_minutes: p.reading_time_minutes || 3,
          }));
          return (
            <TemplateBlogRenderer
              blogSchema={blogSchema}
              breadcrumbSchema={breadcrumbSchema}
              BlogComponent={BlogComponent}
              basePath={basePath}
              blogPosts={blogPosts}
              categories={templateCategories}
              searchQuery={searchQuery}
            />
          );
        }
      } catch (error) {
        console.error(
          'Failed to load Blog component for template',
          templateId,
          ':',
          error
        );
        // Fall through to default blog
      }
    }
  }
  return (
    <DefaultBlogUi
      blogSchema={blogSchema}
      breadcrumbSchema={breadcrumbSchema}
      basePath={basePath}
      categories={categories}
      category={category}
      merchant={merchant}
      posts={posts}
      searchQuery={searchQuery}
      slug={slug}
      totalPosts={totalPosts}
    />
  );
}
