import type { sampleProductsByCategory } from '@/lib/products';

export const PRODUCT_CATEGORY_ALIASES: Record<
  string,
  keyof typeof sampleProductsByCategory
> = {
  bakery: 'food-beverage',
  beauty: 'health-beauty',
  cafe: 'food-beverage',
  cosmetics: 'health-beauty',
  fashion_apparel: 'fashion',
  'fashion-apparel': 'fashion',
  food: 'food-beverage',
  hair: 'hair-extensions',
  handmade: 'handmade',
  home: 'home-goods',
  pharmacy: 'pharmaceuticals',
  restaurant: 'food-beverage',
  tech: 'electronics',
};
