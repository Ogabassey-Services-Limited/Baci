import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
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

export default async function AboutPage({ params }: PageProps) {
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

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(jsonLd as Record<string, unknown>),
        }}
      />
      <StorefrontPageWrapper
        pageName="About"
        merchant={merchant}
        fallback={
          <AboutPageClient
            merchant={merchant}
            aboutPage={aboutPage}
            legacyContent={legacyAboutContent}
          />
        }
      />
    </>
  );
}
