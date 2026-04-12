export const BUSINESS_TYPES = [
  { id: 'fashion', label: 'Fashion & Apparel' },
  { id: 'electronics', label: 'Electronics & Gadgets' },
  { id: 'home-goods', label: 'Home Goods & Decor' },
  { id: 'health-beauty', label: 'Health & Beauty' },
  { id: 'handmade', label: 'Handmade & Crafts' },
  { id: 'food-beverage', label: 'Food & Beverage' },
  { id: 'hair-extensions', label: 'Hair & Extensions' },
  { id: 'pharmaceuticals', label: 'Pharmaceuticals & Medical' },
  { id: 'other', label: 'Other' },
] as const;

export type BusinessTypeOption = (typeof BUSINESS_TYPES)[number];
export type BusinessTypeId = BusinessTypeOption['id'];
