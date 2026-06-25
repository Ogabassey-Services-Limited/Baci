import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateOrganizationSchema } from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { getTemplate, type TemplatePageProps } from '@/templates/registry';
import { ContentPageCrawlSummary } from '../content-page-crawl-summary';
import { ContactPageClient } from '../pages/contact/contact-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function hasNonEmptyText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function ContactPageContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);

  const hasContactInfo = [
    merchant.pages?.contact,
    merchant.email,
    merchant.phone,
    trustProfile.supportEmail,
    trustProfile.supportPhone,
  ].some(hasNonEmptyText);

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
    <script type="application/ld+json">
      {safeJsonLdStringify(contactSchema)}
    </script>
  );

  const templateId = merchant.template_id;
  let ContactComponent: ComponentType<TemplatePageProps> | null = null;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      // try/catch only guards the async component load; the JSX itself is
      // constructed outside so render errors flow to the route error boundary.
      try {
        const components = await template.getComponents();
        ContactComponent = components.Contact ?? null;
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

  if (ContactComponent) {
    return (
      <>
        {jsonLdScript}
        <ContactComponent
          merchant={toTemplateMerchantData(merchant)}
          storeSlug={merchant.slug}
          isPreview={false}
        />
        <ContentPageCrawlSummary
          kind="contact"
          merchantName={merchant.business_name}
          businessType={merchant.business_type}
        />
      </>
    );
  }

  return (
    <>
      {jsonLdScript}
      <ContactPageClient
        merchant={merchant}
        legacyContent={merchant.pages?.contact}
      >
        <ContentPageCrawlSummary
          kind="contact"
          merchantName={merchant.business_name}
          businessType={merchant.business_type}
        />
      </ContactPageClient>
    </>
  );
}
