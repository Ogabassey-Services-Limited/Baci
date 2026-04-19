import type {
  InformationalGuideLink,
  PublishedClusterPost,
} from '@/lib/storefront-content/content-cluster-types';

export type CategoryHubSource = 'merchant' | 'curated' | 'fallback';

export interface CategoryHubFaqItem {
  question: string;
  answer: string;
}

export interface CategoryHubCard {
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export interface CategoryHubIntro {
  heading: string;
  description: string;
  source: CategoryHubSource;
}

export interface CategoryHubModel {
  intro: CategoryHubIntro;
  trustFeatures: string[];
  bestForCards: CategoryHubCard[];
  brandCards: CategoryHubCard[];
  priceBandCards: CategoryHubCard[];
  comparisonLinks: {
    href: string;
    label: string;
  }[];
  guideLinks: InformationalGuideLink[];
  faqItems: CategoryHubFaqItem[];
}

export interface CategoryHubProduct {
  slug: string;
  name: string;
  price: number;
  brand?: string | null;
  condition?: string | null;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

export interface CategoryHubSeoInput {
  heading?: string | null;
  description?: string | null;
  features?: string[] | null;
  faqs?: CategoryHubFaqItem[] | null;
}

export interface CategoryHubBestForCopy {
  title: string;
  description: string;
}

export interface CategoryHubPriceBandCopy {
  slug: string;
  title: string;
  description: string;
}

export interface CategoryHubDefaults {
  intro: {
    heading: string;
    description: string;
  };
  trustFeatures: string[];
  faqItems: CategoryHubFaqItem[];
  bestFor: Record<string, CategoryHubBestForCopy>;
  brandHighlights: {
    heading: string;
    description: string;
  };
  priceBands: CategoryHubPriceBandCopy[];
}

export interface BuildCategoryHubModelInput {
  categorySlug: string;
  categoryName: string;
  merchantBusinessName: string;
  storeUrl: string;
  products: CategoryHubProduct[];
  guidePosts?: PublishedClusterPost[];
  categorySeo?: CategoryHubSeoInput | null;
  collectionSeo?: CategoryHubSeoInput | null;
  isCollection?: boolean;
}
