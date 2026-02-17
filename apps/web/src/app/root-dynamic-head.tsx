import { headers } from 'next/headers';
import { PLATFORM_CONFIG, PLATFORM_PRICING } from '@/config/platform';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateOrganizationSchema,
  generateSoftwareApplicationSchema,
  generateWebSiteSchema,
  type OrganizationData,
} from '@/lib/seo-utils';

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
    </>
  );
}
