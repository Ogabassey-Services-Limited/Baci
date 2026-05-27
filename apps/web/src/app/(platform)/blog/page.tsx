import type { Metadata } from 'next';
import { Suspense } from 'react';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import { PLATFORM_BLOG_CONTEXT } from '@/lib/platform-blog';
import { BlogPageContent, type BlogPageProps } from './blog-page-content';

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

export default function BlogPage(props: BlogPageProps) {
  return (
    <Suspense fallback={<BlogPageFallback />}>
      <BlogPageContent {...props} />
    </Suspense>
  );
}
