import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/json-ld';
import { PLATFORM_CONFIG } from '@/config/platform';
import SubmitTemplateClientPage from './client-page';

const submitTemplateUrl = `${PLATFORM_CONFIG.url}/developers/submit`;

export const metadata: Metadata = {
  title: 'Submit a Storefront Template - Baci Developers',
  description:
    'Submit a storefront template for review and help African merchants launch better Baci commerce experiences.',
  alternates: {
    canonical: submitTemplateUrl,
  },
};

export default function SubmitTemplatePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Submit a Storefront Template - Baci Developers',
          description:
            'Submit a storefront template for review and help African merchants launch better Baci commerce experiences.',
          url: submitTemplateUrl,
          isPartOf: {
            '@type': 'WebSite',
            name: PLATFORM_CONFIG.name,
            url: PLATFORM_CONFIG.url,
          },
        }}
      />
      <SubmitTemplateClientPage />
    </>
  );
}
