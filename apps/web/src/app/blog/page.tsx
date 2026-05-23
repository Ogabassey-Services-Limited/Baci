import '@/app/globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import {
  getPlatformBlogListing,
  PLATFORM_BLOG_CONTEXT,
} from '@/lib/platform-blog';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>;
}

function parsePage(rawPage: string | undefined): number {
  const parsed = Number.parseInt(rawPage ?? '1', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

const BLOG_PAGE_URL = `${PLATFORM_BLOG_CONTEXT.baseUrl}/blog`;
const BLOG_PAGE_TITLE = `Blog - ${PLATFORM_BLOG_CONTEXT.businessName}`;
const BLOG_PAGE_DESCRIPTION =
  'Insights, updates, and practical playbooks for modern African merchants.';
const BLOG_PAGE_SOCIAL_IMAGE = `${PLATFORM_BLOG_CONTEXT.baseUrl}/opengraph-image`;

export const metadata: Metadata = {
  title: BLOG_PAGE_TITLE,
  description: BLOG_PAGE_DESCRIPTION,
  alternates: {
    canonical: BLOG_PAGE_URL,
    types: {
      'application/rss+xml': `${PLATFORM_BLOG_CONTEXT.baseUrl}/blog/feed.xml`,
    },
  },
  openGraph: {
    title: BLOG_PAGE_TITLE,
    description: BLOG_PAGE_DESCRIPTION,
    type: 'website',
    url: BLOG_PAGE_URL,
    siteName: PLATFORM_BLOG_CONTEXT.businessName,
    images: [BLOG_PAGE_SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: BLOG_PAGE_TITLE,
    description: BLOG_PAGE_DESCRIPTION,
    images: [BLOG_PAGE_SOCIAL_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

function BlogPageFallback() {
  return (
    <AppBody>
      <div className="flex min-h-screen flex-col bg-background font-sans">
        <PlatformHeader />
        <main className="flex-1 pb-16 pt-24">
          <section className="container mx-auto px-4 md:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <p className="text-sm text-muted-foreground">Loading posts…</p>
            </div>
          </section>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

export async function BlogPageContent({ searchParams }: BlogPageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const listing = await getPlatformBlogListing({
    limit: BLOG_LISTING_PAGE_SIZE,
    page,
  });
  const totalPages = Math.max(listing.totalPages, 1);

  if (listing.total > 0 && page > totalPages) {
    redirect(asRoute(totalPages === 1 ? '/blog' : `/blog?page=${totalPages}`));
  }

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${PLATFORM_BLOG_CONTEXT.businessName} Blog`,
    description: BLOG_PAGE_DESCRIPTION,
    url: BLOG_PAGE_URL,
    publisher: {
      '@type': 'Organization',
      name: PLATFORM_BLOG_CONTEXT.businessName,
      logo: {
        '@type': 'ImageObject',
        url: PLATFORM_BLOG_CONTEXT.logoUrl,
      },
    },
    blogPost: listing.posts.slice(0, 10).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt || '',
      url: `${BLOG_PAGE_URL}/${post.slug}`,
      datePublished: post.published_at,
      author: {
        '@type': 'Person',
        name: post.author_name || PLATFORM_BLOG_CONTEXT.businessName,
      },
      image: post.featured_image_url || undefined,
    })),
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    {
      name: PLATFORM_BLOG_CONTEXT.businessName,
      url: PLATFORM_BLOG_CONTEXT.baseUrl,
    },
    {
      name: 'Blog',
      url: BLOG_PAGE_URL,
    },
  ]);

  const currentPage = Math.min(page, totalPages);
  const showPagination = totalPages > 1;
  const previousPageHref =
    currentPage > 2
      ? `/blog?page=${currentPage - 1}`
      : currentPage === 2
        ? '/blog'
        : null;
  const nextPageHref = listing.hasMore ? `/blog?page=${currentPage + 1}` : null;

  return (
    <AppBody>
      <div className="flex min-h-screen flex-col bg-background font-sans">
        <script type="application/ld+json">
          {safeJsonLdStringify(blogSchema)}
        </script>
        <script type="application/ld+json">
          {safeJsonLdStringify(breadcrumbSchema)}
        </script>

        <PlatformHeader />
        <main className="flex-1 pb-16 pt-24">
          <section className="container mx-auto px-4 md:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
                The Baci Blog
              </h1>
              <p className="text-lg text-muted-foreground">
                Strategy, product updates, and practical playbooks for growth.
              </p>
            </div>

            {listing.posts.length === 0 ? (
              <div className="mx-auto max-w-2xl rounded-lg border bg-card p-10 text-center">
                <p className="text-lg font-medium">No posts yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  New articles will appear here as soon as they are published.
                </p>
              </div>
            ) : (
              <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
                {listing.posts.map((post) => (
                  <Link
                    key={post.id}
                    href={asRoute(`/blog/${post.slug}`)}
                    className="group"
                  >
                    <article className="flex h-full flex-col rounded-lg border bg-card p-6 transition-shadow group-hover:shadow-md">
                      <p className="mb-2 text-sm text-muted-foreground">
                        {post.category || 'Insights'}
                      </p>
                      <h2 className="mb-3 text-xl font-semibold leading-tight group-hover:text-primary">
                        {post.title}
                      </h2>
                      <p className="mb-4 flex-1 text-sm text-muted-foreground">
                        {post.excerpt || 'Read the latest from the Baci team.'}
                      </p>
                      <p className="text-sm font-medium text-primary">
                        Read article
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            )}

            {showPagination ? (
              <nav className="mx-auto mt-10 flex max-w-4xl items-center justify-between">
                {previousPageHref ? (
                  <Link
                    href={asRoute(previousPageHref)}
                    className="text-sm font-medium text-primary"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Previous
                  </span>
                )}

                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>

                {nextPageHref ? (
                  <Link
                    href={asRoute(nextPageHref)}
                    className="text-sm font-medium text-primary"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Next</span>
                )}
              </nav>
            ) : null}
          </section>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

export default function BlogPage(props: BlogPageProps) {
  return (
    <Suspense fallback={<BlogPageFallback />}>
      <BlogPageContent {...props} />
    </Suspense>
  );
}
