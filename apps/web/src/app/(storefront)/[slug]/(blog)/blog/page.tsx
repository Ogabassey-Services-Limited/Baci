import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BlogListingFallback } from '@/app/(storefront)/[slug]/(blog)/blog/BlogListingFallback';
import { StorefrontDynamicMetadataMarker } from '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker';
import { InformationalClusterIndex } from '@/components/storefront/ogabassey/seo/informational-cluster-index';
import { getCachedBlogListing } from '@/lib/cached-data';
import {
  generateBreadcrumbSchema,
  generateMetaDescription,
  generateSlug,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { buildBlogClusterCollections } from '@/lib/storefront-content/build-blog-cluster-collections';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { isDomainIdentifier } from '@/lib/validation';
import { type BlogPostData, getTemplate } from '@/templates/registry';
import { BlogDiscoverySection } from './blog-discovery-section';
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

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const currentPage = parseBlogListingPage(page);
  const data = await getCachedBlogListing(slug, { page: currentPage });
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
  const description = generateMetaDescription(
    `Read the latest articles, news, and insights from ${data.merchant.business_name}.`,
    160,
    {
      minLength: 110,
      fallback: `Read expert buying guides, product comparisons, and tech updates from ${data.merchant.business_name}. Find practical recommendations tailored for shoppers in Nigeria.`,
    }
  );
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
    description,
    openGraph: {
      title: `Blog | ${data.merchant.business_name}`,
      description,
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
      description,
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

export async function BlogPageContent({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category, page, search } = await searchParams;
  const currentPage = parseBlogListingPage(page);
  const data = await getCachedBlogListing(slug, {
    category,
    page: currentPage,
    searchQuery: search,
  });
  if (!data) {
    notFound();
  }
  const { merchant, posts, categories, totalPosts, searchQuery } = data;
  const baseUrl = buildStoreUrl(merchant);
  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const guideCollections = buildBlogClusterCollections({
    storeUrl: baseUrl,
    posts: posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      tags: post.tags ?? null,
      keywords: null,
      featured_image_url: post.featured_image_url,
      published_at: post.published_at,
      reading_time_minutes: post.reading_time_minutes,
    })),
  });
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
            <>
              <BlogDiscoverySection
                baseUrl={baseUrl}
                categories={categories}
                posts={posts}
              />
              <InformationalClusterIndex collections={guideCollections} />
              <TemplateBlogRenderer
                blogSchema={blogSchema}
                breadcrumbSchema={breadcrumbSchema}
                BlogComponent={BlogComponent}
                basePath={basePath}
                blogPosts={blogPosts}
                categories={templateCategories}
                searchQuery={searchQuery}
              />
            </>
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
    <>
      <BlogDiscoverySection
        baseUrl={baseUrl}
        categories={categories}
        posts={posts}
      />
      <InformationalClusterIndex collections={guideCollections} />
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
    </>
  );
}

export default function BlogPage(props: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <StorefrontDynamicMetadataMarker />
      </Suspense>
      <Suspense fallback={<BlogListingFallback />}>
        <BlogPageContent {...props} />
      </Suspense>
    </>
  );
}
