import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { buildStoreUrl } from '@/lib/store-url';
import { getTemplate } from '@/templates/registry';
import {
  generateAboutPageJsonLd,
  type MerchantAboutPage,
} from '@/types/about-page';
import { AboutPageClient } from './about-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return {
      title: 'About Us',
    };
  }

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const description =
    aboutPage.story ||
    aboutPage.mission ||
    `Learn more about ${merchant.business_name}`;
  const aboutUrl = `${buildStoreUrl(merchant)}/about`;

  return {
    title: `About Us | ${merchant.business_name}`,
    description: description.substring(0, 160),
    openGraph: {
      title: `About ${merchant.business_name}`,
      description: description.substring(0, 160),
      type: 'website',
      url: aboutUrl,
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: aboutUrl,
    },
  };
}

/** Streams JSON-LD separately while the visible page content loads. */
export default function AboutPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <AboutJsonLd params={params} />
      </Suspense>
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

/** Streams JSON-LD structured data independently of page content. */
async function AboutJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) return null;

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  if (!aboutPage.story && !aboutPage.mission && !merchant.pages?.about) {
    return null;
  }

  const baseUrl = buildStoreUrl(merchant);
  const jsonLd = generateAboutPageJsonLd(merchant, aboutPage, baseUrl);

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
      dangerouslySetInnerHTML={{
        __html: safeJsonLdStringify(jsonLd as Record<string, unknown>),
      }}
    />
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
            <AboutComponent
              // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant is a superset of what template components need
              merchant={merchant as any}
              storeSlug={merchant.slug}
              isPreview={false}
            />
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
    <AboutPageClient
      merchant={merchant}
      aboutPage={aboutPage}
      legacyContent={legacyAboutContent}
    />
  );
}
