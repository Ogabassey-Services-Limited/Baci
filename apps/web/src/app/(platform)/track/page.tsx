import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/json-ld';
import { PLATFORM_CONFIG } from '@/config/platform';
import TrackClientPage from './client-page';

const trackUrl = `${PLATFORM_CONFIG.url}/track`;

export const metadata: Metadata = {
  title: 'Track Your Order - Baci',
  description:
    'Track a Baci shipment by entering the tracking number sent after checkout.',
  alternates: {
    canonical: trackUrl,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function TrackPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Track Your Order - Baci',
          description:
            'Track a Baci shipment by entering the tracking number sent after checkout.',
          url: trackUrl,
          isPartOf: {
            '@type': 'WebSite',
            name: PLATFORM_CONFIG.name,
            url: PLATFORM_CONFIG.url,
          },
        }}
      />
      <TrackClientPage />
    </>
  );
}
