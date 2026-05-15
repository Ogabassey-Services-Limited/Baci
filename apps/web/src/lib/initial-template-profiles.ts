import { TEMPLATE_GRID_CONFIG } from '@/lib/initial-template-profile-config';

export type TemplateSection =
  | 'hero'
  | 'story'
  | 'features'
  | 'products'
  | 'newsletter';

export interface InitialTemplateProfile {
  shopNavLabel: string;
  storyTitle: string;
  storyContent: string;
  storyAlign: 'left' | 'center' | 'right';
  featuresTitle: string;
  productGridTitle: string;
  productGridColumns: number;
  productGridLimit: number;
  newsletterTitle: string;
  newsletterDescription: string;
  contentOrder: TemplateSection[];
}

/**
 * Normalizes business type identifiers into starter-template categories.
 * @param businessType - Business type value such as "food-beverage", "restaurant", or "health-beauty".
 * @returns A canonical category key such as "food", "beauty", or the cleaned original value when unmapped.
 */
export function normalizeBusinessType(businessType?: string | null): string {
  const normalized = businessType?.trim().toLowerCase() ?? '';

  switch (normalized) {
    case 'food-beverage':
    case 'restaurant':
      return 'food';
    case 'health-beauty':
    case 'cosmetics':
      return 'beauty';
    case 'hair-extensions':
      return 'hair';
    case 'home-goods':
      return 'home';
    case 'pharmaceuticals':
      return 'pharmacy';
    case 'fashion_apparel':
    case 'fashion-apparel':
      return 'fashion';
    case 'tech':
      return 'electronics';
    default:
      return normalized;
  }
}

/**
 * Returns the starter storefront profile for a merchant business category.
 * @param businessType - Merchant business category from onboarding, or null/undefined when unavailable.
 * @returns An InitialTemplateProfile, falling back to a general shop profile when the category is omitted or unmapped.
 */
export function getInitialTemplateProfile(
  businessType?: string | null
): InitialTemplateProfile {
  switch (normalizeBusinessType(businessType)) {
    case 'food':
      return {
        shopNavLabel: 'Menu',
        storyTitle: 'Fresh meals, simple ordering',
        storyContent:
          'A menu-first storefront for fast browsing, easy pickup, and delivery-ready food orders.',
        storyAlign: 'center',
        featuresTitle: 'Fresh, Fast, Local',
        productGridTitle: 'Popular Dishes',
        productGridColumns: TEMPLATE_GRID_CONFIG.COMPACT.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.COMPACT.limit,
        newsletterTitle: "Get today's specials",
        newsletterDescription:
          'Join the list for fresh menu drops, promos, and limited-time meals.',
        contentOrder: ['hero', 'products', 'story', 'features', 'newsletter'],
      };
    case 'pharmacy':
      return {
        shopNavLabel: 'Health Store',
        storyTitle: 'Wellness essentials you can trust',
        storyContent:
          'Organize healthcare products with clear guidance, trusted fulfillment, and a calm shopping flow.',
        storyAlign: 'left',
        featuresTitle: 'Safe Healthcare Shopping',
        productGridTitle: 'Health Essentials',
        productGridColumns: TEMPLATE_GRID_CONFIG.STANDARD.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.STANDARD.limit,
        newsletterTitle: 'Wellness reminders',
        newsletterDescription:
          'Receive useful restock alerts and practical care updates from the store.',
        contentOrder: ['hero', 'story', 'features', 'products', 'newsletter'],
      };
    case 'fashion':
      return {
        shopNavLabel: 'Collections',
        storyTitle: 'Curated looks for every occasion',
        storyContent:
          'Lead with seasonal drops, visual browsing, and style-forward collections.',
        storyAlign: 'center',
        featuresTitle: 'Style Made Easy',
        productGridTitle: 'Latest Drops',
        productGridColumns: TEMPLATE_GRID_CONFIG.STANDARD.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.STANDARD.limit,
        newsletterTitle: 'Join the style list',
        newsletterDescription:
          'Get first access to new arrivals, limited edits, and styling notes.',
        contentOrder: ['hero', 'products', 'features', 'story', 'newsletter'],
      };
    case 'electronics':
      return {
        shopNavLabel: 'Gadgets',
        storyTitle: 'Tech specs without the confusion',
        storyContent:
          'Help shoppers compare devices, discover upgrades, and buy with confidence.',
        storyAlign: 'left',
        featuresTitle: 'Built for Tech Buyers',
        productGridTitle: 'Featured Gadgets',
        productGridColumns: TEMPLATE_GRID_CONFIG.STANDARD.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.STANDARD.limit,
        newsletterTitle: 'Tech deals and launches',
        newsletterDescription:
          'Get notified about new devices, restocks, and limited gadget deals.',
        contentOrder: ['hero', 'features', 'products', 'story', 'newsletter'],
      };
    case 'beauty':
      return {
        shopNavLabel: 'Beauty Shop',
        storyTitle: 'Routines that feel personal',
        storyContent:
          'Showcase skincare, makeup, and wellness essentials with ingredient-aware merchandising.',
        storyAlign: 'center',
        featuresTitle: 'Glow With Confidence',
        productGridTitle: 'Beauty Essentials',
        productGridColumns: TEMPLATE_GRID_CONFIG.STANDARD.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.STANDARD.limit,
        newsletterTitle: 'Beauty notes',
        newsletterDescription:
          'Receive routine tips, new product alerts, and exclusive beauty offers.',
        contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
      };
    case 'hair':
      return {
        shopNavLabel: 'Hair Store',
        storyTitle: 'Textures, lengths, and finishes',
        storyContent:
          'Make it easy to shop bundles, extensions, and styling essentials by look and texture.',
        storyAlign: 'center',
        featuresTitle: 'Premium Hair Shopping',
        productGridTitle: 'Popular Hair Picks',
        productGridColumns: TEMPLATE_GRID_CONFIG.COMPACT.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.COMPACT.limit,
        newsletterTitle: 'Style drops',
        newsletterDescription:
          'Get updates on new textures, restocks, and care tips for your next style.',
        contentOrder: ['hero', 'products', 'story', 'features', 'newsletter'],
      };
    case 'home':
      return {
        shopNavLabel: 'Home Finds',
        storyTitle: 'A calmer way to furnish a space',
        storyContent:
          'Present decor and home essentials with room-by-room inspiration and careful delivery promises.',
        storyAlign: 'left',
        featuresTitle: 'Designed for Real Homes',
        productGridTitle: 'Curated Home Finds',
        productGridColumns: TEMPLATE_GRID_CONFIG.COMPACT.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.COMPACT.limit,
        newsletterTitle: 'Home inspiration',
        newsletterDescription:
          'Get new decor arrivals, styling ideas, and seasonal home updates.',
        contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
      };
    case 'art':
    case 'handmade':
      return {
        shopNavLabel: 'Craft Shop',
        storyTitle: 'Made by hand, chosen with care',
        storyContent:
          'Highlight maker stories, limited batches, and the personal detail behind every piece.',
        storyAlign: 'center',
        featuresTitle: 'Crafted With Care',
        productGridTitle: 'Handmade Favorites',
        productGridColumns: TEMPLATE_GRID_CONFIG.COMPACT.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.COMPACT.limit,
        newsletterTitle: 'Studio notes',
        newsletterDescription:
          'Follow new handmade drops, maker updates, and small-batch releases.',
        contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
      };
    default:
      return {
        shopNavLabel: 'Shop',
        storyTitle: 'Shop with confidence',
        storyContent:
          'Explore quality products, secure checkout, and reliable fulfillment from this store.',
        storyAlign: 'center',
        featuresTitle: 'Why Choose Us',
        productGridTitle: 'Our Products',
        productGridColumns: TEMPLATE_GRID_CONFIG.STANDARD.columns,
        productGridLimit: TEMPLATE_GRID_CONFIG.STANDARD.limit,
        newsletterTitle: 'Stay Updated',
        newsletterDescription:
          'Subscribe to our newsletter for the latest updates and exclusive offers.',
        contentOrder: ['hero', 'story', 'features', 'products', 'newsletter'],
      };
  }
}
