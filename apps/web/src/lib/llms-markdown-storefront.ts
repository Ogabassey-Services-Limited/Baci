import type { CachedMerchant } from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import {
  coerceStorefrontManageStock,
  getStorefrontAgentAvailability,
} from '@/lib/storefront-agent-availability';
import { buildAgentProductUrl } from '@/lib/storefront-agent-urls';
import type { MerchantAboutPage } from '@/types/about-page';
import type { FAQItem } from '@/types/faq';
import { parseLegacyFAQ } from '@/types/faq';

const MAX_PRODUCTS_IN_CATEGORY_MARKDOWN = 24;

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
    return merchant.faq_items.filter(isFaqItem);
  }

  if (merchant.pages?.faq) {
    return parseLegacyFAQ(merchant.pages.faq);
  }

  return [];
}

function isFaqItem(item: unknown): item is FAQItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as FAQItem).question === 'string' &&
    typeof (item as FAQItem).answer === 'string'
  );
}

function getProductMarkdownMirrorUrl(productUrl: string): string {
  return `${productUrl.replace(/\/+$/, '')}.md`;
}

function isRawDbProduct(product: unknown): product is RawDbProduct {
  return (
    product !== null &&
    typeof product === 'object' &&
    typeof (product as RawDbProduct).id === 'string' &&
    typeof (product as RawDbProduct).name === 'string' &&
    typeof (product as RawDbProduct).price === 'number'
  );
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
  const aboutPage: Partial<MerchantAboutPage> = merchant.about_page || {};
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
  const products = data.products
    .filter(isRawDbProduct)
    .map((product) => normalizeProduct(product));

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
    ...products
      .slice(0, MAX_PRODUCTS_IN_CATEGORY_MARKDOWN)
      .flatMap((product) => {
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
    manage_stock: coerceStorefrontManageStock(rawProduct.manage_stock),
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
