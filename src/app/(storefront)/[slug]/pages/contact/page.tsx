import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { normalizeSocialUrl } from '@/lib/social';
import { createClient } from '@/lib/supabase/server';
import { StorefrontPageWrapper } from '../../storefront-page-wrapper';
import { ContactPageClient } from './contact-page-client';

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
      title: 'Contact Us',
    };
  }

  return {
    title: `Contact Us | ${merchant.business_name}`,
    description: `Get in touch with ${merchant.business_name}. We're here to help with any questions about orders, products, or support.`,
    openGraph: {
      title: `Contact ${merchant.business_name}`,
      description: `Get in touch with ${merchant.business_name}. We're here to help.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check if contact info exists
  const hasContactInfo =
    merchant.pages?.contact || merchant.email || merchant.phone;

  if (!hasContactInfo) {
    notFound();
  }

  // Generate base URL for JSON-LD
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/${slug}`
    : `https://${slug}.${rootDomain}`;

  // Generate ContactPage JSON-LD schema
  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${merchant.business_name}`,
    url: `${baseUrl}/pages/contact`,
    mainEntity: {
      '@type': 'Organization',
      name: merchant.business_name,
      url: baseUrl,
      ...(merchant.logo_url && { logo: merchant.logo_url }),
      ...(merchant.email && { email: merchant.email }),
      ...(merchant.phone && { telephone: merchant.phone }),

      // Add social links if available
      ...(merchant.social_media && {
        sameAs: Object.entries(merchant.social_media)
          .filter(([_, handle]) => typeof handle === 'string')
          .map(([platform, handle]) =>
            normalizeSocialUrl(
              handle as string,
              platform as
              | 'instagram'
              | 'facebook'
              | 'tiktok'
              | 'twitter'
              | 'youtube'
              | 'linkedin'
            )
          )
          .filter((url): url is string => !!url),
      }),
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        ...(merchant.email && { email: merchant.email }),
        ...(merchant.phone && { telephone: merchant.phone }),
        availableLanguage: 'English',
      },
    },
  };

  return (
    <>
      {/* ContactPage JSON-LD Schema */}
      {/* nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      <script
        type="application/ld+json"
        // codeql[js/html-injection] - Safe: JSON-LD sanitized via safeJsonLdStringify
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(contactSchema) }}
      />
      <StorefrontPageWrapper
        pageName="Contact"
        merchant={merchant}
        fallback={
          <ContactPageClient
            merchant={merchant}
            legacyContent={merchant.pages?.contact}
          />
        }
      />
    </>
  );
}
