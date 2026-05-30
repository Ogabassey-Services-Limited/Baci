import type {
  FeatureItem,
  FooterComponent,
  HeaderComponent,
  HeroComponent,
  Link,
  ProductGridComponent,
} from './ai-storefront-normalize-types';

function truncateToWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;

  const truncated = value.slice(0, maxLength);
  const wordBoundary = truncated.lastIndexOf(' ');
  return (wordBoundary > 0 ? truncated.slice(0, wordBoundary) : truncated)
    .replace(/[,.!?;:-]+$/, '')
    .trim();
}

export function defaultLinks(): Link[] {
  return [
    { label: 'Home', url: '/' },
    { label: 'Shop', url: '/products' },
  ];
}

export function defaultFeatureItems(): FeatureItem[] {
  return [
    {
      title: 'Curated selection',
      description: 'Shop products selected for quality and everyday value.',
      icon: 'star',
    },
    {
      title: 'Secure checkout',
      description:
        'Pay safely with protected checkout and clear order updates.',
      icon: 'shield-check',
    },
    {
      title: 'Fast support',
      description: 'Get help quickly before and after every purchase.',
      icon: 'headphones',
    },
  ];
}

export function defaultTrustBadges(): FeatureItem[] {
  return [
    {
      title: 'Secure checkout',
      description: 'Protected payments and clear order confirmations.',
      icon: 'shield-check',
    },
    {
      title: 'Reliable delivery',
      description: 'Order updates from checkout to delivery.',
      icon: 'truck',
    },
    {
      title: 'Quality support',
      description: 'Helpful support when customers need it.',
      icon: 'check',
    },
  ];
}

export function defaultHeader(): HeaderComponent {
  return {
    type: 'Header',
    props: {
      id: 'header',
      showLogo: true,
      showSearch: true,
      showCart: true,
      showMenu: true,
      sticky: true,
      navigationLinks: defaultLinks(),
      ctaButton: { show: false },
      layout: 'logo-left-nav-center',
      searchStyle: 'outline',
      searchRadius: 'md',
      paddingY: 'md',
      glassEffect: false,
    },
  };
}

export function defaultHero(businessName: string): HeroComponent {
  return {
    type: 'Hero',
    props: {
      id: 'hero',
      title: truncateToWordBoundary(`Shop ${businessName}`, 120),
      subtitle:
        'Discover products picked for quality, value, and everyday use.',
      ctaText: 'Shop now',
      ctaLink: '/products',
      overlay: false,
      align: 'center',
      padding: 'medium',
      headingLevel: 'h1',
    },
  };
}

export function defaultProductGrid(): ProductGridComponent {
  return {
    type: 'ProductGrid',
    props: {
      id: 'product-grid',
      title: 'Featured products',
      columns: 3,
      limit: 8,
      sortBy: 'newest',
      showFilters: true,
    },
  };
}

export function defaultFooter(businessName: string): FooterComponent {
  return {
    type: 'Footer',
    props: {
      id: 'footer',
      copyrightText: `(c) ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
      showQuickLinks: true,
      quickLinks: [
        { label: 'About', url: '/about' },
        { label: 'Contact', url: '/contact' },
        { label: 'Terms', url: '/terms' },
      ],
      socialLinks: {},
      showNewsletter: false,
    },
  };
}
