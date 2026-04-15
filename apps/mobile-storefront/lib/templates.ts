/**
 * Mobile Template Registry - Elite 2025 Edition
 * Defines UI patterns for each business category
 */

export type HeaderStyle = 'elite' | 'standard' | 'minimal';
export type HeroVariant = 'parallax' | 'carousel' | 'standard';
export type CategoryStyle = 'pill' | 'circle' | 'card';
export type CardVariant = 'grid' | 'editorial' | 'list';

export interface MobileTemplateConfig {
  headerStyle: HeaderStyle;
  heroVariant: HeroVariant;
  categoryStyle: CategoryStyle;
  cardVariant: CardVariant;
  spacing: 'compact' | 'relaxed';
  borderRadius: 'none' | 'md' | 'xl' | 'full';
  features?: {
    chatWidget?: boolean;
  };
}

export const CATEGORY_TEMPLATES: Record<string, MobileTemplateConfig> = {
  electronics: {
    headerStyle: 'elite',
    heroVariant: 'parallax',
    categoryStyle: 'card',
    cardVariant: 'grid',
    spacing: 'compact',
    borderRadius: 'xl',
  },
  fashion: {
    headerStyle: 'minimal',
    heroVariant: 'carousel',
    categoryStyle: 'pill',
    cardVariant: 'editorial',
    spacing: 'relaxed',
    borderRadius: 'none',
  },
  'health-beauty': {
    headerStyle: 'standard',
    heroVariant: 'carousel',
    categoryStyle: 'circle',
    cardVariant: 'grid',
    spacing: 'relaxed',
    borderRadius: 'full',
  },
  'food-beverage': {
    headerStyle: 'standard',
    heroVariant: 'standard',
    categoryStyle: 'circle',
    cardVariant: 'grid',
    spacing: 'compact',
    borderRadius: 'xl',
  },
  'home-goods': {
    headerStyle: 'standard',
    heroVariant: 'carousel',
    categoryStyle: 'pill',
    cardVariant: 'grid',
    spacing: 'relaxed',
    borderRadius: 'md',
  },
  handmade: {
    headerStyle: 'minimal',
    heroVariant: 'standard',
    categoryStyle: 'pill',
    cardVariant: 'grid',
    spacing: 'relaxed',
    borderRadius: 'md',
  },
  'hair-extensions': {
    headerStyle: 'minimal',
    heroVariant: 'carousel',
    categoryStyle: 'pill',
    cardVariant: 'grid',
    spacing: 'relaxed',
    borderRadius: 'xl',
  },
  pharmaceuticals: {
    headerStyle: 'standard',
    heroVariant: 'standard',
    categoryStyle: 'pill',
    cardVariant: 'list',
    spacing: 'compact',
    borderRadius: 'md',
  },
  default: {
    headerStyle: 'standard',
    heroVariant: 'standard',
    categoryStyle: 'pill',
    cardVariant: 'grid',
    spacing: 'compact',
    borderRadius: 'md',
  },
};

/**
 * Get template configuration for a merchant based on their business type
 */
export function getTemplateConfig(
  businessType?: string,
  manualTemplateId?: string
): MobileTemplateConfig {
  // Manual override (e.g. for Ogabassey)
  if (manualTemplateId === 'ogabassey') return CATEGORY_TEMPLATES.electronics;

  if (!businessType) return CATEGORY_TEMPLATES.default;

  const normalized = businessType.toLowerCase().replace('_', '-');
  return CATEGORY_TEMPLATES[normalized] || CATEGORY_TEMPLATES.default;
}
