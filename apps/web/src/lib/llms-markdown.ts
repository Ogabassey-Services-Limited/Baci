import { getBlogPostTextPreview } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-content';
import type { CachedMerchant } from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import { getStorefrontAgentAvailability } from '@/lib/storefront-agent-availability';
import { buildAgentProductUrl } from '@/lib/storefront-agent-urls';
import type { MerchantAboutPage } from '@/types/about-page';
import { type FAQItem, parseLegacyFAQ } from '@/types/faq';

const CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600';

function createMarkdownResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      'X-Robots-Tag': 'noarchive',
    },
  });
}

export function markdownResponse(body: string): Response {
  return createMarkdownResponse(body);
}

export function notFoundMarkdownResponse(message: string): Response {
  return new Response(message, {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'X-Robots-Tag': 'noindex, noarchive',
    },
  });
}

export function buildPlatformHomeMarkdown(origin: string): string {
  return [
    '# Baci',
    '',
    '> Baci is an AI-native commerce platform for merchants. It helps businesses launch storefronts, manage products, process payments, and operate from a unified dashboard.',
    '',
    '## Summary',
    '- Merchant-facing platform for store creation, catalog management, and operations.',
    '- Core platform surfaces: onboarding, pricing, features, login, dashboard, builder.',
    '- Public marketing pages are the best source for positioning and packaging details.',
    '',
    '## Primary Routes',
    `- ${origin}/onboarding`,
    `- ${origin}/pricing`,
    `- ${origin}/features`,
    `- ${origin}/login`,
    `- ${origin}/dashboard`,
    '',
    '## Notes',
    '- `/dashboard` and many `/api/*` routes are authenticated.',
    '- Use `/openapi.json` and `/sitemap.xml` for machine-readable references.',
    '',
  ].join('\n');
}

export function buildPlatformPricingMarkdown(origin: string): string {
  return [
    '# Baci Pricing',
    '',
    '> Pricing summary for the Baci platform.',
    '',
    '## Plans',
    '- Free: NGN 0. Best for testing ideas and small hobby shops. Includes 1 store, up to 10 products, basic storefront, Baci subdomain, and standard support.',
    '- Pro: NGN 5,000 per month. For growing businesses. Includes unlimited products, custom domain, advanced analytics, priority support, marketing tools, and no transaction fees.',
    '- Premium: NGN 15,000 per month. For scaling enterprises. Includes everything in Pro, multiple staff accounts, advanced reports, dedicated account management, API access, and wholesale features.',
    '',
    '## Related Routes',
    `- ${origin}/onboarding`,
    `- ${origin}/contact`,
    '',
  ].join('\n');
}

export function buildPlatformFeaturesMarkdown(origin: string): string {
  return [
    '# Baci Features',
    '',
    '> Feature summary for the Baci platform.',
    '',
    '## Capabilities',
    '- AI-powered store generation: generate structure, copy, and branding from business inputs.',
    '- Smart theming: derive and apply brand colors from uploaded assets.',
    '- Inventory management: manage products, variants, and stock alerts.',
    '- Real-time analytics: track visitors, sales, and conversion performance.',
    '- Mobile-first storefronts: responsive experiences optimized for mobile shoppers.',
    '- Custom domains: connect merchant-owned domains or start with a platform subdomain.',
    '',
    '## Related Routes',
    `- ${origin}/pricing`,
    `- ${origin}/onboarding`,
    '',
  ].join('\n');
}

export function buildPlatformOnboardingMarkdown(origin: string): string {
  return [
    '# Baci Onboarding',
    '',
    '> Onboarding starts the AI-assisted flow for creating a merchant storefront and configuring initial business details.',
    '',
    '## What This Route Does',
    '- Collects merchant and business information.',
    '- Starts the AI-assisted store setup flow.',
    '- Leads into authenticated setup and builder flows.',
    '',
    '## Related Routes',
    `- ${origin}/pricing`,
    `- ${origin}/login`,
    `- ${origin}/dashboard`,
    '',
    '## Notes',
    '- This route leads to stateful account creation and setup actions.',
    '',
  ].join('\n');
}

function buildMerchantIntro(
  merchant: CachedMerchant,
  origin: string
): string[] {
  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Storefront for ${merchant.business_name}.`;

  return [
    `# ${merchant.business_name}`,
    '',
    `> ${description}`,
    '',
    '## Storefront Summary',
    `- Business type: ${merchant.business_type || 'Not specified'}`,
    `- Canonical host: ${origin}`,
    merchant.phone ? `- Phone: ${merchant.phone}` : '',
    merchant.email ? `- Email: ${merchant.email}` : '',
    '',
  ].filter(Boolean);
}

function getFaqItems(merchant: CachedMerchant): FAQItem[] {
  if (
    merchant.faq_items &&
    Array.isArray(merchant.faq_items) &&
    merchant.faq_items.length > 0
  ) {
    return merchant.faq_items as FAQItem[];
  }

  if (merchant.pages?.faq) {
    return parseLegacyFAQ(merchant.pages.faq);
  }

  return [];
}

function getProductMarkdownMirrorUrl(productUrl: string): string {
  return `${productUrl.replace(/\/+$/, '')}.md`;
}

export function buildStorefrontHomeMarkdown(
  merchant: CachedMerchant,
  origin: string
): string {
  return [
    ...buildMerchantIntro(merchant, origin),
    '## Primary Routes',
    `- ${origin}/sitemap.xml`,
    `- ${origin}/cart`,
    `- ${origin}/checkout`,
    `- ${origin}/track-order`,
    merchant.pages?.about || merchant.about_page ? `- ${origin}/about` : '',
    merchant.pages?.contact || merchant.email || merchant.phone
      ? `- ${origin}/contact`
      : '',
    getFaqItems(merchant).length > 0 ? `- ${origin}/faq` : '',
    '',
    '## Route Patterns',
    `- ${origin}/{category}`,
    `- ${origin}/{category}/index.html.md`,
    `- ${origin}/{category}/{productSlug}`,
    `- ${origin}/{category}/{productSlug}.md`,
    `- ${origin}/products/{productSlug}`,
    `- ${origin}/blog/index.html.md`,
    `- ${origin}/blog/{postSlug}.md`,
    '',
    '## Notes',
    '- `/checkout`, `/account`, and wallet or payment flows are stateful.',
    '- Prefer sitemap and product/category pages for public catalog discovery.',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildStorefrontAboutMarkdown(
  merchant: CachedMerchant,
  origin: string
): string {
  const aboutPage = (merchant.about_page || {}) as MerchantAboutPage;
  const values =
    aboutPage.values && aboutPage.values.length > 0
      ? aboutPage.values.map((value) => `- ${value}`)
      : [];

  return [
    ...buildMerchantIntro(merchant, origin),
    '# About',
    '',
    aboutPage.story ||
      merchant.pages?.about ||
      `About ${merchant.business_name}`,
    '',
    aboutPage.mission ? `## Mission\n${aboutPage.mission}\n` : '',
    aboutPage.vision ? `## Vision\n${aboutPage.vision}\n` : '',
    values.length > 0 ? '## Values' : '',
    ...values,
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildStorefrontContactMarkdown(
  merchant: CachedMerchant,
  origin: string
): string {
  return [
    ...buildMerchantIntro(merchant, origin),
    '# Contact',
    '',
    merchant.pages?.contact || `Contact ${merchant.business_name}.`,
    '',
    '## Contact Details',
    merchant.phone ? `- Phone: ${merchant.phone}` : '',
    merchant.email ? `- Email: ${merchant.email}` : '',
    merchant.business_address ? `- Address: ${merchant.business_address}` : '',
    '',
    `- Contact page: ${origin}/contact`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildStorefrontFaqMarkdown(
  merchant: CachedMerchant,
  origin: string
): string {
  const faqItems = getFaqItems(merchant);

  return [
    ...buildMerchantIntro(merchant, origin),
    '# FAQ',
    '',
    ...faqItems.flatMap((item) => [`## ${item.question}`, '', item.answer, '']),
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCategoryMarkdown(
  merchant: CachedMerchant,
  origin: string,
  categorySlug: string,
  data: {
    isCollection: boolean;
    name?: string;
    fallbackName?: string;
    fallbackDescription?: string;
    products: unknown[];
  }
): string {
  const title = data.isCollection
    ? data.name || categorySlug
    : data.fallbackName || categorySlug;
  const description =
    data.fallbackDescription ||
    `Browse ${title} from ${merchant.business_name}.`;
  const products = (data.products as RawDbProduct[]).map((product) =>
    normalizeProduct(product)
  );

  return [
    `# ${title}`,
    '',
    `> ${description}`,
    '',
    `- Store: ${merchant.business_name}`,
    `- Canonical category URL: ${origin}/${categorySlug}`,
    `- Markdown mirror: ${origin}/${categorySlug}/index.html.md`,
    `- Product count in this view: ${products.length}`,
    '',
    '## Products',
    ...products.slice(0, 24).flatMap((product) => {
      const productUrl = buildAgentProductUrl({ baseUrl: origin, product });

      return [
        `- [${product.name}](${getProductMarkdownMirrorUrl(productUrl)}): ${product.price} ${merchant.payout_currency || 'NGN'}${product.brand ? `, ${product.brand}` : ''}`,
      ];
    }),
    '',
  ].join('\n');
}

export function buildProductMarkdown(
  merchant: CachedMerchant,
  origin: string,
  rawProduct: RawDbProduct
): string {
  const product = normalizeProduct(rawProduct);
  const productUrl = buildAgentProductUrl({ baseUrl: origin, product });
  const agentAvailability = getStorefrontAgentAvailability({
    manage_stock: rawProduct.manage_stock ?? false,
    stock: rawProduct.stock,
    stock_quantity: rawProduct.stock_quantity,
    low_stock_threshold: rawProduct.low_stock_threshold,
  });
  const compareAt =
    product.compare_at_price && product.compare_at_price > product.price
      ? `- Compare at price: ${product.compare_at_price} ${merchant.payout_currency || 'NGN'}`
      : '';
  const description = product.description || `Buy ${product.name}.`;

  return [
    `# ${product.name}`,
    '',
    `> ${description}`,
    '',
    '## Summary',
    `- Store: ${merchant.business_name}`,
    `- Category: ${product.category}`,
    product.brand ? `- Brand: ${product.brand}` : '',
    `- Price: ${product.price} ${merchant.payout_currency || 'NGN'}`,
    compareAt,
    `- Condition: ${product.condition}`,
    `- Availability: ${agentAvailability.availability}`,
    `- inventory_policy: ${agentAvailability.inventory_policy}`,
    `- is_purchasable: ${String(agentAvailability.is_purchasable)}`,
    `- quantity_available: ${agentAvailability.quantity_available ?? 'untracked'}`,
    `- Canonical product URL: ${productUrl}`,
    `- Markdown mirror: ${getProductMarkdownMirrorUrl(productUrl)}`,
    product.images[0] ? `- Primary image: ${product.images[0]}` : '',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

interface BlogListPost {
  title: string;
  slug: string;
  excerpt?: string | null;
  category?: string | null;
  author_name?: string | null;
  published_at?: string | null;
  reading_time_minutes?: number | null;
}

export function buildBlogIndexMarkdown(
  merchant: { business_name: string; slug: string },
  origin: string,
  posts: BlogListPost[],
  categories: string[]
): string {
  return [
    `# ${merchant.business_name} Blog`,
    '',
    `> Latest published articles and editorial content from ${merchant.business_name}.`,
    '',
    `- Blog URL: ${origin}/blog`,
    `- Markdown mirror: ${origin}/blog/index.html.md`,
    categories.length > 0 ? `- Categories: ${categories.join(', ')}` : '',
    '',
    '## Posts',
    ...posts
      .slice(0, 24)
      .flatMap((post) => [
        `- [${post.title}](${origin}/blog/${post.slug}.md): ${post.excerpt || 'Published blog post'}${post.reading_time_minutes ? ` (${post.reading_time_minutes} min read)` : ''}`,
      ]),
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

interface BlogPostMarkdownInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: unknown;
  category?: string | null;
  author_name?: string | null;
  published_at?: string | null;
  reading_time_minutes?: number | null;
  tags?: string[] | null;
}

export function buildBlogPostMarkdown(
  merchant: { business_name: string },
  origin: string,
  post: BlogPostMarkdownInput
): string {
  const preview =
    post.excerpt ||
    getBlogPostTextPreview(post.content, 600, 'Read this post.');

  return [
    `# ${post.title}`,
    '',
    `> ${preview}`,
    '',
    '## Summary',
    `- Publisher: ${merchant.business_name}`,
    post.author_name ? `- Author: ${post.author_name}` : '',
    post.category ? `- Category: ${post.category}` : '',
    post.published_at ? `- Published: ${post.published_at}` : '',
    post.reading_time_minutes
      ? `- Reading time: ${post.reading_time_minutes} minutes`
      : '',
    post.tags && post.tags.length > 0 ? `- Tags: ${post.tags.join(', ')}` : '',
    `- Canonical blog URL: ${origin}/blog/${post.slug}`,
    `- Markdown mirror: ${origin}/blog/${post.slug}.md`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
}
