export interface HeroCarouselSlide {
  id: string;
  imageUrl: string;
  headline: string;
  description: string;
  cta: string;
  link: string;
}

export const HERO_CAROUSEL_FIELD_CANDIDATES = {
  headline: ['headline', 'title', 'heading', 'headline_text'],
  description: ['description', 'subtitle', 'subheading', 'sub_title'],
  image: ['imageUrl', 'image', 'image_url', 'image_uri'],
  cta: ['cta', 'ctaText', 'cta_text'],
  link: ['link', 'url', 'ctaLink', 'cta_link'],
  id: ['id', 'slideId', 'key'],
} as const;
