import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontDynamicMetadataMarker } from '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { getTemplate } from '@/templates/registry';
import {
  generateAboutPageJsonLd,
  hasAboutPageContent,
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
    notFound();
  }

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const legacyAboutContent = merchant.pages?.about;

  const description =
    aboutPage.story ||
    aboutPage.mission ||
    legacyAboutContent ||
    `Learn more about ${merchant.business_name}`;
  const baseUrl = buildStoreUrl(merchant);
  const canonicalUrl = `${baseUrl}/about`;
  const seoDescription = generateMetaDescription(description);

  return {
    title: `About Us | ${merchant.business_name}`,
    description: seoDescription,
    openGraph: {
      title: `About ${merchant.business_name}`,
      description: seoDescription,
      type: 'website',
      url: canonicalUrl,
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: getIndexableRobotsMetadata(),
  };
}

/** Streams JSON-LD separately while the visible page content loads. */
export default function AboutPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <StorefrontDynamicMetadataMarker />
      </Suspense>
      <Suspense fallback={null}>
        <AboutJsonLd params={params} />
      </Suspense>
      <AboutContent params={params} />
    </>
  );
}

/** Streams JSON-LD structured data independently of page content. */
export async function AboutJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) return null;

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  if (!hasAboutPageContent(aboutPage, merchant.pages?.about)) {
    return null;
  }

  const baseUrl = buildStoreUrl(merchant);
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const jsonLd = generateAboutPageJsonLd(
    merchant,
    aboutPage,
    baseUrl,
    trustProfile
  );

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
              merchant={toTemplateMerchantData(merchant)}
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
