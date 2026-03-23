import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { getTemplate } from '@/templates/registry';
import {
  generateAboutPageJsonLd,
  type MerchantAboutPage,
} from '@/types/about-page';
import { AboutPageClient } from '../pages/about/about-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return { title: 'About Us' };
  }

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const description =
    aboutPage.story ||
    aboutPage.mission ||
    `Learn more about ${merchant.business_name}`;

  return {
    title: `About Us | ${merchant.business_name}`,
    description: description.substring(0, 160),
    openGraph: {
      title: `About ${merchant.business_name}`,
      description: description.substring(0, 160),
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: '/about',
    },
  };
}

/**
 * Synchronous page wrapper ensures the H1 tag appears in the initial SSR HTML,
 * rather than being deferred to RSC streaming (which crawlers like Ahrefs miss).
 */
export default function AboutPage({ params }: PageProps) {
  return (
    <>
      <h1 className="sr-only">About Us</h1>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="sr-only">Loading about page...</span>
          </div>
        }
      >
        <AboutContent params={params} />
      </Suspense>
    </>
  );
}

async function AboutContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const legacyAboutContent = merchant.pages?.about;

  if (!aboutPage.story && !aboutPage.mission && !legacyAboutContent) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/${merchant.slug}`
    : `https://${merchant.slug}.${rootDomain}`;

  const jsonLd = generateAboutPageJsonLd(merchant, aboutPage, baseUrl);

  // Resolve template component server-side for SEO (H1 in SSR HTML)
  const templateId = merchant.template_id;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.About) {
          const AboutComponent = components.About;
          return (
            <>
              <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
                dangerouslySetInnerHTML={{
                  __html: safeJsonLdStringify(
                    jsonLd as Record<string, unknown>
                  ),
                }}
              />
              <AboutComponent
                // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant is a superset of what template components need
                merchant={merchant as any}
                storeSlug={merchant.slug}
                isPreview={false}
              />
            </>
          );
        }
      } catch (error) {
        console.error(
          'Failed to load About component for template',
          templateId,
          ':',
          error
        );
      }
    }
  }

  // Fallback to default about page
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(jsonLd as Record<string, unknown>),
        }}
      />
      <AboutPageClient
        merchant={merchant}
        aboutPage={aboutPage}
        legacyContent={legacyAboutContent}
      />
    </>
  );
}
