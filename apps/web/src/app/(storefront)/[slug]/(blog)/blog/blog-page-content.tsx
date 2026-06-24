import { notFound, redirect } from 'next/navigation';
import type { ComponentType } from 'react';
import { InformationalClusterIndex } from '@/components/storefront/ogabassey/seo/informational-cluster-index';
import { getBlogAuthorPageLinks } from '@/lib/blog-authors';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { buildBlogOrganizationId } from '@/lib/blog-organization-id';
import { buildBlogOrganizationSchema } from '@/lib/blog-organization-schema';
import { getBlogStructuredDataImageUrls } from '@/lib/blog-structured-data-images';
import { getCachedBlogListing } from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { asRoute } from '@/lib/routes';
import { generateBreadcrumbSchema, generateSlug } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { buildBlogClusterCollections } from '@/lib/storefront-content/build-blog-cluster-collections';
import type { BlogPostData, TemplateBlogPageProps } from '@/templates/registry';
import { getTemplate } from '@/templates/registry';
import { BlogDiscoverySection } from './blog-discovery-section';
import { preloadOgabasseyRootBlogListingHeroImage } from './blog-listing-hero-image-preload';
import { parseBlogListingPage } from './blog-listing-page-params';
import { BlogListingPagination } from './blog-listing-pagination';
import { buildBlogListingRouteHref } from './blog-listing-route';
import { buildBlogListingSchemaUrl } from './blog-listing-schema-url';
import {
  type BlogSearchParamValue,
  toSingleBlogSearchParam,
} from './blog-search-params';
import { DefaultBlogUi } from './default-blog-ui';
import { TemplateBlogRenderer } from './template-blog-renderer';

export interface BlogPageProps {
  itemListSchemaUrl?: string;
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    category?: BlogSearchParamValue;
    page?: BlogSearchParamValue;
    search?: BlogSearchParamValue;
  }>;
}

function getTemplateBlogBasePath(baseUrl: string): string {
  try {
    const pathname = new URL(baseUrl).pathname.replace(/\/+$/g, '');
    return pathname === '/' ? '' : pathname;
  } catch {
    return '';
  }
}

export async function BlogPageContent({
  itemListSchemaUrl,
  params,
  searchParams,
}: BlogPageProps) {
  const { slug } = await params;
  const searchParamValues = await searchParams;
  const category = toSingleBlogSearchParam(searchParamValues.category);
  const page = toSingleBlogSearchParam(searchParamValues.page);
  const search = toSingleBlogSearchParam(searchParamValues.search);
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
  const effectiveSearchQuery = searchQuery ?? search;
  const totalPages = Math.max(
    1,
    Math.ceil(totalPosts / BLOG_LISTING_PAGE_SIZE)
  );
  const publicCategories = filterPublicBlogCategories(categories);
  const baseUrl = buildStoreUrl(merchant);
  const organizationSchema = buildBlogOrganizationSchema(merchant, baseUrl);
  const organizationId =
    typeof organizationSchema['@id'] === 'string'
      ? organizationSchema['@id']
      : buildBlogOrganizationId(baseUrl);
  const basePath = baseUrl;
  const templateBasePath = getTemplateBlogBasePath(baseUrl);
  const authorLinks = getBlogAuthorPageLinks(slug);

  if (currentPage > totalPages) {
    redirect(
      asRoute(
        buildBlogListingRouteHref({
          storeBasePath: basePath,
          category,
          page: totalPages,
          search: effectiveSearchQuery,
        })
      )
    );
  }
  const previousPageUrl =
    currentPage > 1
      ? buildBlogListingSchemaUrl({
          baseUrl,
          category,
          page: currentPage - 1,
          search: effectiveSearchQuery,
        })
      : undefined;
  const nextPageUrl =
    currentPage < totalPages
      ? buildBlogListingSchemaUrl({
          baseUrl,
          category,
          page: currentPage + 1,
          search: effectiveSearchQuery,
        })
      : undefined;
  const paginationHeadLinks = (
    <>
      {previousPageUrl ? <link href={previousPageUrl} rel="prev" /> : null}
      {nextPageUrl ? <link href={nextPageUrl} rel="next" /> : null}
    </>
  );
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
  preloadOgabasseyRootBlogListingHeroImage({
    category,
    posts,
    searchQuery: effectiveSearchQuery,
    templateId: merchant.template_id,
  });
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${baseUrl}/blog#blog`,
    name: `${merchant.business_name} Blog`,
    description: `Read the latest articles, news, and insights from ${merchant.business_name}.`,
    url: `${baseUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      '@id': organizationId,
      name: merchant.business_name,
      logo: merchant.logo_url
        ? {
            '@type': 'ImageObject',
            url: merchant.logo_url,
          }
        : undefined,
    },
    blogPost: posts.slice(0, 10).map((post) => {
      const imageUrls = getBlogStructuredDataImageUrls(post);
      return {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || '',
        url: `${baseUrl}/blog/${post.slug}`,
        datePublished: post.published_at,
        author: {
          '@type': 'Person',
          name: post.author_name || merchant.business_name,
        },
        ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
      };
    }),
  };
  const itemListPosts = posts.slice(0, 10);
  const itemListPositionOffset = (currentPage - 1) * BLOG_LISTING_PAGE_SIZE;
  const itemListSchema =
    itemListPosts.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${merchant.business_name} Blog articles`,
          url:
            itemListSchemaUrl ??
            buildBlogListingSchemaUrl({
              baseUrl,
              category,
              page: currentPage,
              search: effectiveSearchQuery,
            }),
          numberOfItems: totalPosts,
          itemListElement: itemListPosts.map((post, index) => ({
            '@type': 'ListItem',
            position: itemListPositionOffset + index + 1,
            url: `${baseUrl}/blog/${post.slug}`,
            name: post.title,
          })),
        }
      : undefined;
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
      let templateBlogUi: {
        BlogComponent: ComponentType<TemplateBlogPageProps>;
        categories: { name: string; slug: string }[];
        posts: BlogPostData[];
      } | null = null;
      try {
        const components = await template.getComponents();
        if (components.Blog) {
          templateBlogUi = {
            BlogComponent: components.Blog,
            categories: publicCategories.map((cat) => ({
              name: cat,
              slug: generateSlug(cat),
            })),
            posts: posts.map((p) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              excerpt: p.excerpt || '',
              category: p.category || '',
              author_name: p.author_name || merchant.business_name,
              published_at: p.published_at,
              featured_image_url: p.featured_image_url || '',
              reading_time_minutes: p.reading_time_minutes || 3,
            })),
          };
        }
      } catch (error) {
        console.error(
          'Failed to load Blog component for template',
          templateId,
          ':',
          error
        );
      }
      if (templateBlogUi) {
        return (
          <>
            {paginationHeadLinks}
            <TemplateBlogRenderer
              blogSchema={blogSchema}
              breadcrumbSchema={breadcrumbSchema}
              organizationSchema={organizationSchema}
              itemListSchema={effectiveSearchQuery ? undefined : itemListSchema}
              BlogComponent={templateBlogUi.BlogComponent}
              basePath={templateBasePath}
              blogPosts={templateBlogUi.posts}
              categories={templateBlogUi.categories}
              category={category}
              searchQuery={effectiveSearchQuery}
            />
            <BlogListingPagination
              storeBasePath={basePath}
              currentPage={currentPage}
              totalPages={totalPages}
              category={category}
              search={effectiveSearchQuery}
            />
            <InformationalClusterIndex collections={guideCollections} />
            <BlogDiscoverySection
              baseUrl={baseUrl}
              authors={authorLinks}
              categories={publicCategories}
              posts={posts}
            />
          </>
        );
      }
    }
  }
  return (
    <>
      {paginationHeadLinks}
      <DefaultBlogUi
        blogSchema={blogSchema}
        breadcrumbSchema={breadcrumbSchema}
        organizationSchema={organizationSchema}
        itemListSchema={itemListSchema}
        basePath={basePath}
        categories={publicCategories}
        category={category}
        merchant={merchant}
        posts={posts}
        searchQuery={effectiveSearchQuery}
        slug={slug}
        totalPosts={totalPosts}
        currentPage={currentPage}
      />
      <InformationalClusterIndex collections={guideCollections} />
      <BlogDiscoverySection
        baseUrl={baseUrl}
        authors={authorLinks}
        categories={publicCategories}
        posts={posts}
      />
    </>
  );
}
