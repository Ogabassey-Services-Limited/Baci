import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { OgabasseyV2Quiz } from '@/components/storefront/ogabassey/pages/quiz';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

const QUIZ_DESCRIPTION = 'Play the Ogabassey Super Quiz with loyalty points.';

export const metadata: Metadata = {
  description: QUIZ_DESCRIPTION,
  title: 'Super Quiz | Ogabassey',
};

export default async function QuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const lookupKey = slug.toLowerCase();
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(lookupKey)
    : await getCachedMerchant(lookupKey);

  if (merchant?.template_id !== 'ogabassey') {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    description: QUIZ_DESCRIPTION,
    name: 'Ogabassey Super Quiz',
  };

  return (
    <section aria-label="Super Quiz">
      <JsonLd data={jsonLd} />
      <OgabasseyV2Quiz merchantSlug={merchant.slug} />
    </section>
  );
}
