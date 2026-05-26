import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OgabasseyV2Quiz } from '@/components/storefront/ogabassey/pages/quiz';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

const QUIZ_DESCRIPTION = 'Play the Ogabassey Prize Quiz with loyalty points.';

export const metadata: Metadata = {
  description: QUIZ_DESCRIPTION,
  title: 'Prize Quiz | Ogabassey',
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

  if (!merchant || merchant.template_id !== 'ogabassey') {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    description: QUIZ_DESCRIPTION,
    name: 'Ogabassey Prize Quiz',
  };

  return (
    <section aria-label="Prize Quiz">
      <script type="application/ld+json">{safeJsonLdStringify(jsonLd)}</script>
      <OgabasseyV2Quiz merchantSlug={merchant.slug} />
    </section>
  );
}
