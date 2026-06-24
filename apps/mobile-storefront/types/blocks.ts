/**
 * Page Configuration and Block Types
 * Mirrors the Baci Web platform's Puck-based configuration
 */

export interface PageConfig {
  content: Block[];
  theme?: unknown;
  root: {
    props: {
      title: string;
    };
  };
}

export type Block =
  | HeaderBlock
  | HeroCarouselBlock
  | FeaturesBlock
  | ProductGridBlock
  | NewsletterBlock
  | FooterBlock
  | CategoryRailBlock;

export interface BaseBlock {
  type: string;
  props: {
    id: string;
    [key: string]: unknown;
  };
}

export interface HeaderBlock extends BaseBlock {
  type: 'Header';
  props: {
    id: string;
    showLogo: boolean;
    showSearch: boolean;
    showCart: boolean;
    storeName: string;
    logoUrl?: string;
  };
}

export interface HeroCarouselBlock extends BaseBlock {
  type: 'HeroCarousel';
  props: {
    id: string;
    slides: {
      image: string;
      title: string;
      subtitle: string;
      ctaText: string;
      ctaLink: string;
    }[];
    autoplayDelay?: number;
  };
}

export interface FeaturesBlock extends BaseBlock {
  type: 'Features';
  props: {
    id: string;
    title: string;
    features: {
      title: string;
      description: string;
      icon: string;
    }[];
  };
}

export interface ProductGridBlock extends BaseBlock {
  type: 'ProductGrid';
  props: {
    id: string;
    title: string;
    limit?: number;
    sortBy?: string;
  };
}

export interface CategoryRailBlock extends BaseBlock {
  type: 'CategoryRail';
  props: {
    id: string;
    title?: string;
    slug?: string;
  };
}

export interface NewsletterBlock extends BaseBlock {
  type: 'Newsletter';
  props: {
    id: string;
    title: string;
    description: string;
  };
}

export interface FooterBlock extends BaseBlock {
  type: 'Footer';
  props: {
    id: string;
  };
}
