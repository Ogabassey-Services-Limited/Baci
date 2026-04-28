import { NextResponse } from 'next/server';

export type LlmsSurface = 'platform-admin' | 'merchant-storefront';
type LlmsLink = { title: string; path: string; note: string };

const DEFAULT_ROOT_DOMAIN = 'usebaci.com';
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600';

const PLATFORM_PRIMARY_LINKS: LlmsLink[] = [
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

const PLATFORM_AUTH_LINKS: LlmsLink[] = [
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

const PLATFORM_OPTIONAL_LINKS: LlmsLink[] = [
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

const STOREFRONT_PRIMARY_LINKS: LlmsLink[] = [
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

const STOREFRONT_OPTIONAL_LINKS: LlmsLink[] = [
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

function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .split(':')[0]
    .replace(/^www\./, '');
}

export function detectLlmsSurface(
  hostname: string,
  rootDomain: string,
  requestHeaders?: Headers
): LlmsSurface {
  if (
    requestHeaders?.get('x-merchant-slug') ||
    requestHeaders?.get('x-custom-domain')
  ) {
    return 'merchant-storefront';
  }

  const normalizedHost = normalizeHostname(hostname);
  const normalizedRoot = normalizeHostname(rootDomain || DEFAULT_ROOT_DOMAIN);

  if (
    normalizedHost === normalizedRoot ||
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost.endsWith('.vercel.app')
  ) {
    return 'platform-admin';
  }

  return 'merchant-storefront';
}

function formatLinkList(baseUrl: string, links: LlmsLink[]): string[] {
  return links.map(
    ({ title, path, note }) => `- [${title}](${baseUrl}${path}): ${note}`
  );
}

function buildPlatformLlms(baseUrl: string, full: boolean): string {
  const details = full
    ? [
        'This file is for the Baci platform domain. It describes the merchant admin, builder, and platform discovery surface.',
        'Authenticated routes such as `/dashboard` and many `/api/*` endpoints require a signed-in merchant session.',
        'Treat the public marketing pages as canonical for pricing, product positioning, and platform capabilities.',
      ]
    : [
        'This file is for the Baci platform domain and focuses on the merchant admin and AI store builder surface.',
      ];

  return [
    '# Baci Admin',
    '',
    '> Baci is an AI-native commerce platform for merchants. This file describes the platform domain used for merchant onboarding, authentication, dashboard operations, and admin tooling.',
    '',
    ...details,
    '',
    '## Primary',
    ...formatLinkList(baseUrl, PLATFORM_PRIMARY_LINKS),
    '',
    '## Authenticated',
    ...formatLinkList(
      baseUrl,
      full ? PLATFORM_AUTH_LINKS : PLATFORM_AUTH_LINKS.slice(0, 1)
    ),
    '',
    '## Read-Only Guidance',
    '- Prefer public marketing pages, docs, and `openapi.json` for factual answers.',
    '- Treat `/dashboard`, `/builder`, and non-public `/api/*` routes as auth-gated surfaces.',
    '- Do not attempt mutations, merchant settings changes, payment actions, or staff actions unless explicitly requested by the user.',
    '',
    '## Guidance',
    `- [Robots](${baseUrl}/robots.txt): Crawl policy for the platform domain`,
    `- [Full LLM Context](${baseUrl}/llms-full.txt): Expanded platform/admin guidance`,
    `- [Well-Known Alias](${baseUrl}/.well-known/llms.txt): Compatibility alias for clients that probe under /.well-known`,
    '',
    '## Optional',
    ...formatLinkList(baseUrl, PLATFORM_OPTIONAL_LINKS),
    '',
  ].join('\n');
}

function buildStorefrontLlms(baseUrl: string, full: boolean): string {
  const details = full
    ? [
        'This file is domain-specific for a Baci-powered storefront. Use the current host as the canonical storefront origin.',
        'The most useful entry points are the homepage, sitemap, category pages, product pages, cart, checkout, order tracking, and policy pages.',
        'Do not trigger live checkout submissions, account mutations, or authenticated customer actions unless the user explicitly asks for them.',
      ]
    : [
        'This file is domain-specific for a Baci-powered storefront and focuses on public shopping and customer self-service pages.',
      ];

  return [
    '# Baci Storefront',
    '',
    '> This domain serves a merchant storefront powered by Baci. The content here is primarily for catalog discovery, product detail understanding, customer policies, and shopping flows.',
    '',
    ...details,
    '',
    '## Primary',
    ...formatLinkList(baseUrl, STOREFRONT_PRIMARY_LINKS),
    '',
    '## Read-Only Guidance',
    '- Safe default reads are the homepage, sitemap, category pages, product pages, blog, and policy pages on the current host.',
    '- Treat `/cart`, `/checkout`, `/account`, and any POST-capable customer flow as stateful surfaces.',
    '- Do not submit checkout, login, account updates, or wallet actions unless the user explicitly asks.',
    '',
    '## Route Patterns',
    `- ${baseUrl}/{category}: Category listing pages`,
    `- ${baseUrl}/{category}/{productSlug}: Canonical product detail pages`,
    `- ${baseUrl}/products/{productSlug}: Legacy or fallback product route on some storefronts`,
    '',
    '## Machine-Readable Commerce',
    `- [Agent Commerce Manifest](${baseUrl}/agent-commerce.json): Capabilities, API version, policy links, checkout base URL, and feed URLs`,
    '',
    '## Guidance',
    `- [Robots](${baseUrl}/robots.txt): Crawl policy for this storefront host`,
    `- [Full LLM Context](${baseUrl}/llms-full.txt): Expanded storefront guidance`,
    `- [Well-Known Alias](${baseUrl}/.well-known/llms.txt): Compatibility alias for clients that probe under /.well-known`,
    '',
    '## Optional',
    ...formatLinkList(baseUrl, STOREFRONT_OPTIONAL_LINKS),
    '',
    full
      ? 'Use the current host as canonical and avoid cross-domain assumptions.'
      : '',
    '',
  ].join('\n');
}

export function buildLlmsText(
  hostname: string,
  origin: string,
  full: boolean,
  requestHeaders?: Headers
): string {
  const surface = detectLlmsSurface(
    hostname,
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN,
    requestHeaders
  );

  if (surface === 'platform-admin') {
    return buildPlatformLlms(origin, full);
  }

  return buildStorefrontLlms(origin, full);
}

export function createLlmsResponse(
  request: Request,
  full: boolean
): NextResponse {
  const url = new URL(request.url);
  const body = buildLlmsText(
    url.hostname,
    `${url.protocol}//${url.host}`,
    full,
    request.headers
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      'X-Robots-Tag': 'noarchive',
    },
  });
}
