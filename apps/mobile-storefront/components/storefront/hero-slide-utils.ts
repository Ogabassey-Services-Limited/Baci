import { HERO_CAROUSEL_FIELD_CANDIDATES } from '@baci/shared';
import type { HeroSlide } from './Hero';

export type RawHeroSlide = Record<string, string | undefined>;

const DEFAULT_CTA_TEXT = 'Shop Now';
const DEFAULT_CTA_LINK = '/category/all';

function pickFirstNonEmpty(values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized.length > 0) return normalized;
  }
  return null;
}

function pickFromSlide(slide: RawHeroSlide, candidates: readonly string[]) {
  return pickFirstNonEmpty(candidates.map((field) => slide[field]));
}

export function normalizeHeroSlides(
  rawSlides: RawHeroSlide[] | null | undefined
): HeroSlide[] {
  if (!Array.isArray(rawSlides) || rawSlides.length === 0) return [];

  return rawSlides
    .map((slide) => {
      const title =
        pickFromSlide(slide, HERO_CAROUSEL_FIELD_CANDIDATES.headline) || '';
      const subtitle =
        pickFromSlide(slide, HERO_CAROUSEL_FIELD_CANDIDATES.description) || '';
      const image =
        pickFromSlide(slide, HERO_CAROUSEL_FIELD_CANDIDATES.image) || '';
      const ctaText =
        pickFromSlide(slide, HERO_CAROUSEL_FIELD_CANDIDATES.cta) ||
        DEFAULT_CTA_TEXT;
      const ctaLink = (pickFromSlide(
        slide,
        HERO_CAROUSEL_FIELD_CANDIDATES.link
      ) || DEFAULT_CTA_LINK) as HeroSlide['ctaLink'];

      return {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink,
      } satisfies HeroSlide;
    })
    .filter(
      (slide) =>
        slide.title.length > 0 ||
        slide.subtitle.length > 0 ||
        slide.image.length > 0
    );
}

export function resolveHeroSlides(
  blockSlides: RawHeroSlide[] | null | undefined,
  merchantSlides: RawHeroSlide[] | null | undefined,
  preferMerchantSlides = false
) {
  if (preferMerchantSlides) {
    const normalizedMerchantSlides = normalizeHeroSlides(merchantSlides);
    if (normalizedMerchantSlides.length > 0) {
      return normalizedMerchantSlides;
    }
  }

  const normalizedBlockSlides = normalizeHeroSlides(blockSlides);
  if (normalizedBlockSlides.length > 0) {
    return normalizedBlockSlides;
  }

  return normalizeHeroSlides(merchantSlides);
}

export function getFallbackHeroSlides(storeName?: string): HeroSlide[] {
  const title =
    storeName && storeName.trim().length > 0
      ? `Welcome to ${storeName.trim()}`
      : 'Welcome to Our Store';

  return [
    {
      title,
      subtitle: 'Discover top deals and new arrivals',
      image: '',
      ctaText: 'Shop Now',
      ctaLink: '/category/all' as HeroSlide['ctaLink'],
    },
  ];
}
