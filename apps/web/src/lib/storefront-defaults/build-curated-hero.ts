import { normalizeBusinessType } from '@/lib/initial-template-profiles';

export function buildCuratedHero(businessName: string, businessType: string) {
  const category = normalizeBusinessType(businessType);
  return {
    id: 'Hero-home',
    title:
      category === 'fashion'
        ? `Discover ${businessName}`
        : `Explore products from ${businessName}`,
    subtitle: `Browse the collection from ${businessName}.`,
    ctaText: 'Explore products',
    ctaLink: '#products',
    align: 'center' as const,
    padding: 'large' as const,
    headingLevel: 'h1' as const,
    gradient:
      'linear-gradient(135deg, var(--store-primary), var(--store-accent))',
  };
}
