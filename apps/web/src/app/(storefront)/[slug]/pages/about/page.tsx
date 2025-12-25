import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { sanitizeHtml } from '@/lib/sanitize';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import {
  generateAboutPageJsonLd,
  type MerchantAboutPage,
} from '@/types/about-page';
import { AboutPageClient } from './about-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getMerchant(slug: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !merchant) {
    return null;
  }

  return merchant;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

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

  return {
    title: `About Us | ${merchant.business_name}`,
    description: description.substring(0, 160),
    openGraph: {
      title: `About ${merchant.business_name}`,
      description: description.substring(0, 160),
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
  };
}

export default async function AboutPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const legacyAboutContent = merchant.pages?.about;

  // If no structured about page and no legacy content, show not found
  if (!aboutPage.story && !aboutPage.mission && !legacyAboutContent) {
    notFound();
  }

  // Generate base URL for JSON-LD (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Generate JSON-LD structured data
  const jsonLd = generateAboutPageJsonLd(merchant, aboutPage, baseUrl);

  // SANITIZE ON SERVER for performance (Client component doesn't need 30KB lib)
  const sanitizedStory = aboutPage.story
    ? sanitizeHtml(aboutPage.story)
    : undefined;
  const sanitizedLegacyContent = legacyAboutContent
    ? sanitizeHtml(legacyAboutContent)
    : undefined;

  return (
    <>
      <script
        type="application/ld+json"
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
            sanitizedStory={sanitizedStory}
            sanitizedLegacyContent={sanitizedLegacyContent}
          />
        }
      />
    </>
  );
}
