/** Link metadata rendered into llms.txt navigation sections. */
export type LlmsLink = {
  readonly title: string;
  readonly path: string;
  readonly note: string;
};

export const PLATFORM_PRIMARY_LINKS: readonly LlmsLink[] = [
  {
    title: 'Home',
    path: '/index.html.md',
    note: 'Markdown mirror of the platform homepage and positioning',
  },
  {
    title: 'Onboarding',
    path: '/onboarding.md',
    note: 'Markdown mirror of the AI-assisted store creation flow',
  },
  {
    title: 'Login',
    path: '/login',
    note: 'Merchant authentication entry point',
  },
  {
    title: 'Pricing',
    path: '/pricing.md',
    note: 'Markdown mirror of subscription plans and packaging',
  },
  {
    title: 'Features',
    path: '/features.md',
    note: 'Markdown mirror of platform capabilities and channel support',
  },
  {
    title: 'Developers',
    path: '/developers/submit',
    note: 'Integration and partner entry point',
  },
  {
    title: 'OpenAPI',
    path: '/openapi.json',
    note: 'Machine-readable API schema',
  },
  {
    title: 'Sitemap',
    path: '/sitemap.xml',
    note: 'Canonical platform URL inventory',
  },
];

export const PLATFORM_AUTH_LINKS: readonly LlmsLink[] = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    note: 'Authenticated merchant admin application',
  },
  {
    title: 'Builder',
    path: '/builder',
    note: 'Authenticated visual builder experience',
  },
];

export const PLATFORM_OPTIONAL_LINKS: readonly LlmsLink[] = [
  {
    title: 'Blog',
    path: '/blog',
    note: 'Editorial and announcement content',
  },
  {
    title: 'Contact',
    path: '/contact',
    note: 'Sales and support contact points',
  },
  {
    title: 'Terms',
    path: '/terms',
    note: 'Platform terms',
  },
  {
    title: 'Privacy',
    path: '/privacy',
    note: 'Platform privacy notice',
  },
];

export const STOREFRONT_PRIMARY_LINKS: readonly LlmsLink[] = [
  {
    title: 'Home',
    path: '/index.html.md',
    note: 'Markdown mirror of the storefront homepage and main shopping paths',
  },
  {
    title: 'Sitemap',
    path: '/sitemap.xml',
    note: 'Canonical inventory of category, product, and supporting pages',
  },
  {
    title: 'Cart',
    path: '/cart',
    note: 'Active shopping cart',
  },
  {
    title: 'Checkout',
    path: '/checkout',
    note: 'Live checkout flow; treat as read-only unless explicitly asked to purchase',
  },
  {
    title: 'Track Order',
    path: '/track-order',
    note: 'Order lookup and fulfillment tracking',
  },
  {
    title: 'Account',
    path: '/account',
    note: 'Customer account entry point',
  },
  {
    title: 'Wishlist',
    path: '/wishlist',
    note: 'Saved products',
  },
  {
    title: 'Reviews',
    path: '/reviews',
    note: 'Customer review surface',
  },
  {
    title: 'Blog',
    path: '/blog',
    note: 'Merchant editorial and content marketing',
  },
];

export const STOREFRONT_OPTIONAL_LINKS: readonly LlmsLink[] = [
  {
    title: 'About',
    path: '/about.md',
    note: 'Markdown mirror of merchant background and trust content',
  },
  {
    title: 'Contact',
    path: '/contact.md',
    note: 'Markdown mirror of contact and support details',
  },
  {
    title: 'FAQ',
    path: '/faq.md',
    note: 'Markdown mirror of common customer questions',
  },
  {
    title: 'Terms',
    path: '/terms',
    note: 'Store policies and terms',
  },
  {
    title: 'Privacy',
    path: '/privacy',
    note: 'Store privacy notice',
  },
];
