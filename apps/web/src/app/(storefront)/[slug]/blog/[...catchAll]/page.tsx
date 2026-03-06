import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { getCachedBlogPost } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { isDomainIdentifier } from '@/lib/validation';
import { resolveLegacyBlogPath } from '../resolve-legacy-blog-path';

/**
 * Catch-all route for legacy blog URLs.
 *
 * Redirects only true legacy post aliases to their canonical slug and
 * returns a 404 for fake archive/search/feed paths.
 *
 * Handles legacy aliases like:
 * - /blog/iphone/the-iphone-15-what-we-know-so-far
 * - /blog/2024/10/14/macbook-air-m1-in-2024-the-perfect-laptop-or-time-to-look-elsewhere
 *
 * Returns 404 for unsupported legacy paths like:
 * - /blog/tag/iphone
 * - /blog/category/1976/1
 * - /blog/search.php
 * - /blog/post-slug/feed
 */
export default async function BlogCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string; catchAll: string[] }>;
}) {
  const { slug, catchAll } = await params;
  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const resolution = resolveLegacyBlogPath(catchAll);

  if (resolution.type === 'sitemap') {
    permanentRedirect(asRoute(`${basePath}/sitemap.xml`));
  }

  if (resolution.type === 'post-alias') {
    const blogPost = await getLegacyBlogPost(
      slug,
      resolution.candidatePostSlug
    );
    if (blogPost) {
      permanentRedirect(asRoute(`${basePath}/blog/${blogPost.post.slug}`));
    }
  }

  notFound();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; catchAll: string[] }>;
}): Promise<Metadata> {
  const { slug, catchAll } = await params;
  const resolution = resolveLegacyBlogPath(catchAll);
  const { basePath, baseUrl } = await getRequestUrlContext(slug);
  const requestedUrl = `${baseUrl}${basePath}/blog/${catchAll
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;

  if (resolution.type === 'post-alias') {
    const blogPost = await getLegacyBlogPost(
      slug,
      resolution.candidatePostSlug
    );
    if (blogPost) {
      return {
        title: `${blogPost.post.title} | ${blogPost.merchant.business_name}`,
        alternates: {
          canonical: `${baseUrl}${basePath}/blog/${blogPost.post.slug}`,
        },
        robots: {
          index: false,
          follow: false,
        },
      };
    }
  }

  return {
    title: 'Page Not Found',
    alternates: {
      canonical: requestedUrl,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

const getLegacyBlogPost = cache(
  async (slug: string, candidatePostSlug: string) =>
    getCachedBlogPost(slug, candidatePostSlug)
);

async function getRequestUrlContext(slug: string) {
  const headersList = await headers();
  const host =
    headersList.get('host') ||
    (isDomainIdentifier(slug) ? slug : `${slug}.usebaci.com`);
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';

  return {
    basePath: isDomainIdentifier(slug) ? '' : `/${slug}`,
    baseUrl: `${protocol}://${host}`,
  };
}
