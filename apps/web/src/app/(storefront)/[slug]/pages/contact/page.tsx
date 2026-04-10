import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { normalizeSocialUrl } from '@/lib/social';
import { getTemplate } from '@/templates/registry';
import { ContactPageClient } from './contact-page-client';

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
    alternates: {
      canonical: '/contact',
    },
  };
}

/** Streams JSON-LD separately while the visible page content loads. */
export default function ContactPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <ContactJsonLd params={params} />
      </Suspense>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="sr-only">Loading contact page...</span>
          </div>
        }
      >
        <ContactContent params={params} />
      </Suspense>
    </>
  );
}

/** Streams JSON-LD structured data independently of page content. */
async function ContactJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) return null;

  const hasContactInfo =
    merchant.pages?.contact || merchant.email || merchant.phone;
  if (!hasContactInfo) return null;

  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/${merchant.slug}`
    : `https://${merchant.slug}.${rootDomain}`;

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
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(contactSchema) }}
    />
  );
}

async function ContactContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const hasContactInfo =
    merchant.pages?.contact || merchant.email || merchant.phone;
  if (!hasContactInfo) {
    notFound();
  }

  // Resolve template component server-side for SEO (H1 in SSR HTML)
  const templateId = merchant.template_id;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Contact) {
          const ContactComponent = components.Contact;
          return (
            <ContactComponent
              // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant is a superset of what template components need
              merchant={merchant as any}
              storeSlug={merchant.slug}
              isPreview={false}
            />
          );
        }
      } catch (error) {
        console.error(
          'Failed to load Contact component for template',
          templateId,
          ':',
          error
        );
      }
    }
  }

  return (
    <ContactPageClient
      merchant={merchant}
      legacyContent={merchant.pages?.contact}
    />
  );
}
