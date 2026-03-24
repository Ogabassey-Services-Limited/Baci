import { notFound } from 'next/navigation';
import {
  type BlogPost,
  OgabasseyV2Blog,
} from '@/components/storefront/ogabassey/pages/blog';
import { getCachedBlogListing } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getBlogData(merchantSlug: string) {
  const result = await getCachedBlogListing(merchantSlug);
  if (!result) return null;

  return {
    merchant: result.merchant,
    posts: result.posts as BlogPost[],
    categories: result.categories,
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBlogData(slug);

  if (!data) {
    return { title: 'Blog - Not Found' };
  }

  return {
    title: `Blog | ${data.merchant.business_name}`,
    description: `Read the latest articles, tips, and insights from ${data.merchant.business_name}.`,
  };
}

export default async function BlogPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBlogData(slug);

  if (!data) {
    notFound();
  }

  const baseUrl = buildStoreUrl(data.merchant);
  const blogUrl = `${baseUrl}/blog`;

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${data.merchant.business_name} Blog`,
    description: `Read the latest articles, tips, and insights from ${data.merchant.business_name}.`,
    url: blogUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': blogUrl },
    author: {
      '@type': 'Organization',
      name: data.merchant.business_name,
      url: baseUrl,
    },
    blogPost: data.posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${blogUrl}/${post.slug}`,
      datePublished: post.published_at,
      description: post.excerpt || '',
    })),
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: data.merchant.business_name, url: baseUrl },
    { name: 'Blog', url: blogUrl },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />
      <OgabasseyV2Blog
        posts={data.posts}
        merchantSlug={slug}
        categories={data.categories}
      />
    </>
  );
}
