import { TEMPLATE_GRID_CONFIG } from '@/lib/initial-template-profile-config';

export type TemplateSection =
  | 'hero'
  | 'story'
  | 'features'
  | 'products'
  | 'newsletter';

export interface InitialTemplateProfile {
  subject: string;
  shopNavLabel: string;
  storyAlign: 'left' | 'center' | 'right';
  productGridColumns: number;
  productGridLimit: number;
  contentOrder: TemplateSection[];
}

const standard = TEMPLATE_GRID_CONFIG.STANDARD;
const compact = TEMPLATE_GRID_CONFIG.COMPACT;
const defaultProfile: InitialTemplateProfile = {
  subject: 'products',
  shopNavLabel: 'Shop',
  storyAlign: 'center',
  productGridColumns: standard.columns,
  productGridLimit: standard.limit,
  contentOrder: ['hero', 'story', 'features', 'products', 'newsletter'],
};
const profiles: Record<string, InitialTemplateProfile> = {
  fashion: {
    subject: 'styles',
    shopNavLabel: 'Collections',
    storyAlign: 'center',
    productGridColumns: standard.columns,
    productGridLimit: standard.limit,
    contentOrder: ['hero', 'products', 'features', 'story', 'newsletter'],
  },
  food: {
    subject: 'menu items',
    shopNavLabel: 'Menu',
    storyAlign: 'center',
    productGridColumns: compact.columns,
    productGridLimit: compact.limit,
    contentOrder: ['hero', 'products', 'story', 'features', 'newsletter'],
  },
  electronics: {
    subject: 'devices',
    shopNavLabel: 'Gadgets',
    storyAlign: 'left',
    productGridColumns: standard.columns,
    productGridLimit: standard.limit,
    contentOrder: ['hero', 'features', 'products', 'story', 'newsletter'],
  },
  pharmacy: {
    subject: 'health products',
    shopNavLabel: 'Health Store',
    storyAlign: 'left',
    productGridColumns: standard.columns,
    productGridLimit: standard.limit,
    contentOrder: ['hero', 'story', 'features', 'products', 'newsletter'],
  },
  beauty: {
    subject: 'beauty products',
    shopNavLabel: 'Beauty Shop',
    storyAlign: 'center',
    productGridColumns: standard.columns,
    productGridLimit: standard.limit,
    contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
  },
  hair: {
    subject: 'hair products',
    shopNavLabel: 'Hair Store',
    storyAlign: 'center',
    productGridColumns: compact.columns,
    productGridLimit: compact.limit,
    contentOrder: ['hero', 'products', 'story', 'features', 'newsletter'],
  },
  home: {
    subject: 'home products',
    shopNavLabel: 'Home Finds',
    storyAlign: 'left',
    productGridColumns: compact.columns,
    productGridLimit: compact.limit,
    contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
  },
  art: {
    subject: 'handmade products',
    shopNavLabel: 'Craft Shop',
    storyAlign: 'center',
    productGridColumns: compact.columns,
    productGridLimit: compact.limit,
    contentOrder: ['hero', 'story', 'products', 'features', 'newsletter'],
  },
};

export function normalizeBusinessType(businessType?: string | null): string {
  const normalized = businessType?.trim().toLowerCase() ?? '';
  const aliases: Record<string, string> = {
    'food-beverage': 'food',
    restaurant: 'food',
    'health-beauty': 'beauty',
    cosmetics: 'beauty',
    'hair-extensions': 'hair',
    'home-goods': 'home',
    handmade: 'art',
    pharmaceuticals: 'pharmacy',
    fashion_apparel: 'fashion',
    'fashion-apparel': 'fashion',
    tech: 'electronics',
  };
  return aliases[normalized] ?? normalized;
}

export function getInitialTemplateProfile(
  businessType?: string | null
): InitialTemplateProfile {
  const profile =
    profiles[normalizeBusinessType(businessType)] ?? defaultProfile;
  return { ...profile, contentOrder: [...profile.contentOrder] };
}
