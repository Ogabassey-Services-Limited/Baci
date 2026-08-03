import type { TemplateSection } from '@/lib/initial-template-profiles';

export const curatedProfileCases: {
  businessType: string;
  subject: string;
  shopNavLabel: string;
  contentOrder: TemplateSection[];
}[] = [
  {
    businessType: 'fashion',
    subject: 'styles',
    shopNavLabel: 'Collections',
    contentOrder: ['hero', 'products', 'features', 'story', 'newsletter'],
  },
  {
    businessType: 'food',
    subject: 'menu items',
    shopNavLabel: 'Menu',
    contentOrder: ['hero', 'products', 'story', 'features', 'newsletter'],
  },
  {
    businessType: 'electronics',
    subject: 'devices',
    shopNavLabel: 'Gadgets',
    contentOrder: ['hero', 'features', 'products', 'story', 'newsletter'],
  },
  {
    businessType: 'pharmacy',
    subject: 'health products',
    shopNavLabel: 'Health Store',
    contentOrder: ['hero', 'story', 'features', 'products', 'newsletter'],
  },
  {
    businessType: 'beauty',
    subject: 'beauty products',
    shopNavLabel: 'Beauty Shop',
    contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
  },
  {
    businessType: 'hair',
    subject: 'hair products',
    shopNavLabel: 'Hair Store',
    contentOrder: ['hero', 'products', 'story', 'features', 'newsletter'],
  },
  {
    businessType: 'home',
    subject: 'home products',
    shopNavLabel: 'Home Finds',
    contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
  },
  {
    businessType: 'art',
    subject: 'handmade products',
    shopNavLabel: 'Craft Shop',
    contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
  },
  {
    businessType: 'unknown-type',
    subject: 'products',
    shopNavLabel: 'Shop',
    contentOrder: ['hero', 'story', 'features', 'products', 'newsletter'],
  },
];

export const blankCuratedProfileCase = {
  businessName: '   ',
  businessType: 'unknown-type',
  expectedName: 'Your Store',
};
