import { normalizeBusinessType } from '@/lib/initial-template-profiles';

interface CuratedHeroCopy {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

export function buildCuratedHero(businessType: string, copy: CuratedHeroCopy) {
  const category = normalizeBusinessType(businessType);
  const backgroundGradient =
    {
      fashion:
        'linear-gradient(135deg, var(--store-primary), var(--store-accent))',
      food: 'linear-gradient(135deg, var(--store-accent), var(--store-background))',
      electronics:
        'linear-gradient(135deg, var(--store-primary), var(--store-background))',
      pharmacy:
        'linear-gradient(135deg, var(--store-accent), var(--store-primary))',
    }[category] ??
    'linear-gradient(135deg, var(--store-background), var(--store-primary))';
  return {
    id: 'Hero-home',
    ...copy,
    align: 'center' as const,
    padding: 'large' as const,
    headingLevel: 'h1' as const,
    backgroundGradient,
  };
}
