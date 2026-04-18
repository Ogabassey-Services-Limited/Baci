import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  generateOrganizationSchema,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { getTemplate } from '@/templates/registry';
import { ContactPageClient } from '../pages/contact/contact-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return { title: 'Contact Us' };
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const canonicalUrl = `${baseUrl}/contact`;
  const description = generateMetaDescription(
    `Get in touch with ${merchant.business_name}. We're here to help.`
  );

  return {
    title: `Contact Us | ${merchant.business_name}`,
    description,
    openGraph: {
      title: `Contact ${merchant.business_name}`,
      description,
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

export default async function ContactPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);

  const hasContactInfo =
    merchant.pages?.contact ||
    merchant.email ||
    merchant.phone ||
    trustProfile.supportEmail ||
    trustProfile.supportPhone;

  if (!hasContactInfo) {
    notFound();
  }

  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${merchant.business_name}`,
    url: `${baseUrl}/contact`,
    mainEntity: generateOrganizationSchema({
      name: merchant.business_name,
      url: baseUrl,
      country: merchant.country,
      logo: merchant.logo_url || undefined,
      email: trustProfile.supportEmail || merchant.email || undefined,
      telephone: trustProfile.supportPhone || merchant.phone || undefined,
      socialMedia:
        Object.keys(trustProfile.socialLinks).length > 0
          ? trustProfile.socialLinks
          : (merchant.social_media as Record<string, string> | undefined),
      trustProfile,
    }),
  };

  const jsonLdScript = (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(contactSchema) }}
    />
  );

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
            <>
              {jsonLdScript}
              <ContactComponent
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
          'Failed to load Contact component for template',
          templateId,
          ':',
          error
        );
      }
    }
  }

  // Fallback to default contact page
  return (
    <>
      {jsonLdScript}
      <ContactPageClient
        merchant={merchant}
        legacyContent={merchant.pages?.contact}
      />
    </>
  );
}
