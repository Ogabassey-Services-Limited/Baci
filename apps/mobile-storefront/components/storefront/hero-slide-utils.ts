import type { HeroSlide } from './Hero';

type RawHeroSlide = Record<string, string | undefined>;

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

export function normalizeHeroSlides(rawSlides: RawHeroSlide[] | null | undefined) {
  if (!rawSlides || rawSlides.length === 0) return [];

  return rawSlides
    .map((slide) => {
      const title =
        pickFirstNonEmpty([
          slide.headline,
          slide.title,
          slide.heading,
          slide.headline_text,
        ]) || '';
      const subtitle =
        pickFirstNonEmpty([
          slide.description,
          slide.subtitle,
          slide.subheading,
          slide.sub_title,
        ]) || '';
      const image =
        pickFirstNonEmpty([
          slide.imageUrl,
          slide.image_url,
          slide.image,
          slide.image_uri,
        ]) || '';
      const ctaText =
        pickFirstNonEmpty([slide.cta, slide.ctaText, slide.cta_text]) ||
        DEFAULT_CTA_TEXT;
      const ctaLink =
        pickFirstNonEmpty([
          slide.link,
          slide.url,
          slide.ctaLink,
          slide.cta_link,
        ]) ||
        DEFAULT_CTA_LINK;

      return {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink: ctaLink as HeroSlide['ctaLink'],
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
      : 'Welcome to Ogabassey';

  return [
    {
      title,
      subtitle: 'Discover top deals and new arrivals',
      image: '',
      ctaText: 'Shop Now',
      ctaLink: '/category/all',
    },
  ];
}
