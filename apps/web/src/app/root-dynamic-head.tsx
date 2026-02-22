import { headers } from 'next/headers';
import {
  MOBILE_APPS,
  PLATFORM_CONFIG,
  PLATFORM_PRICING,
} from '@/config/platform';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateOrganizationSchema,
  generateSoftwareApplicationSchema,
  generateWebSiteSchema,
  type OrganizationData,
} from '@/lib/seo-utils';

function deriveOS(appStoreUrl: string, playStoreUrl: string): string {
  const platforms = [
    ...(appStoreUrl ? ['iOS'] : []),
    ...(playStoreUrl ? ['Android'] : []),
  ];
  return platforms.join(', ');
}

export async function RootDynamicHead() {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;

  // Build organization data for schema generator
  const organizationData: OrganizationData = {
    name: PLATFORM_CONFIG.name,
    url: PLATFORM_CONFIG.url,
    logo: `${PLATFORM_CONFIG.url}/baci-logo.svg`,
    description: PLATFORM_CONFIG.description,
    socialMedia: {
      twitter: 'https://twitter.com/usebaci',
      linkedin: 'https://linkedin.com/company/usebaci',
      instagram: 'https://instagram.com/usebaci',
    },
  };

  const organizationSchema = generateOrganizationSchema(organizationData);

  const websiteSchema = generateWebSiteSchema(
    PLATFORM_CONFIG.name,
    PLATFORM_CONFIG.url,
    `${PLATFORM_CONFIG.url}/search?q={search_term_string}`
  );

  const softwareApplicationSchema =
    generateSoftwareApplicationSchema(PLATFORM_PRICING);

  // Mobile app schemas for app indexing and rich search results
  const adminInstallUrls = [
    MOBILE_APPS.admin.appStoreUrl,
    MOBILE_APPS.admin.playStoreUrl,
  ].filter(Boolean);

  const storefrontInstallUrls = [
    MOBILE_APPS.storefront.appStoreUrl,
    MOBILE_APPS.storefront.playStoreUrl,
  ].filter(Boolean);

  const adminOS = deriveOS(
    MOBILE_APPS.admin.appStoreUrl,
    MOBILE_APPS.admin.playStoreUrl
  );

  const storefrontOS = deriveOS(
    MOBILE_APPS.storefront.appStoreUrl,
    MOBILE_APPS.storefront.playStoreUrl
  );

  const mobileAppSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: MOBILE_APPS.admin.name,
      ...(adminOS ? { operatingSystem: adminOS } : {}),
      applicationCategory: 'BusinessApplication',
      description:
        'AI-powered e-commerce builder for African merchants. Create your online store, manage inventory, accept payments, and sell on WhatsApp.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      ...(adminInstallUrls.length > 0 ? { installUrl: adminInstallUrls } : {}),
    },
    ...(storefrontInstallUrls.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'MobileApplication',
            name: MOBILE_APPS.storefront.name,
            ...(storefrontOS ? { operatingSystem: storefrontOS } : {}),
            applicationCategory: 'ShoppingApplication',
            description:
              'Shop top African brands with fast delivery and flexible payment options including bank transfer, cards, and USSD.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            installUrl: storefrontInstallUrls,
          },
        ]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(softwareApplicationSchema),
        }}
      />
      {mobileAppSchemas.map((schema) => (
        <script
          key={schema.name}
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify(schema),
          }}
        />
      ))}
    </>
  );
}
