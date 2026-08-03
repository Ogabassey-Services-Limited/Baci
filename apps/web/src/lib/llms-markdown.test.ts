import { describe, expect, it } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import {
  buildBlogIndexMarkdown,
  buildBlogPostMarkdown,
  buildCategoryMarkdown,
  buildPlatformFeaturesMarkdown,
  buildPlatformHomeMarkdown,
  buildProductMarkdown,
  buildStorefrontFaqMarkdown,
  buildStorefrontHomeMarkdown,
  notFoundMarkdownResponse,
  unavailableMarkdownResponse,
} from './llms-markdown';

describe('markdown failure responses', () => {
  it('serves a retryable 503 WITHOUT noindex so a transient blip cannot deindex the URL (PR4b review r6)', () => {
    const response = unavailableMarkdownResponse('# Temporarily Unavailable\n');

    expect(response.status).toBe(503);
    // The whole point of a retryable 503 is "come back later". A crawler or LLM
    // ingester that honours X-Robots-Tag: noindex would DROP the URL during the
    // outage — defeating the 503 entirely. noindex belongs only on genuinely
    // degraded 200s, never on a 5xx that means "retry".
    expect(response.headers.get('X-Robots-Tag')).not.toMatch(/noindex/i);
    // Never cache the failure, and tell the crawler when to come back.
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('keeps noindex on a genuine 404 (not a retryable failure)', () => {
    const response = notFoundMarkdownResponse('# Not Found\n');

    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toMatch(/noindex/i);
  });
});

const merchant: CachedMerchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  site_title: 'Ogabassey',
  site_tagline: 'Easybuy Gadgets',
  site_description: 'Shop phones, accessories, and gadgets.',
  business_type: 'electronics',
  logo_url: '',
  phone: '+2348000000000',
  email: 'hello@ogabassey.com',
  slug: 'ogabassey',
  business_address: 'Lagos, Nigeria',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'tpl-1',
  plan_tier: 'pro',
  premium_features: null,
  faq_items: [
    { question: 'Do you offer delivery?', answer: 'Yes, nationwide.' },
  ],
};

describe('platform markdown mirrors', () => {
  it('builds the platform home markdown', () => {
    const result = buildPlatformHomeMarkdown('https://usebaci.com');

    expect(result).toContain('# Baci');
    expect(result).toContain('https://usebaci.com/onboarding');
  });

  it('builds the platform features markdown', () => {
    const result = buildPlatformFeaturesMarkdown('https://usebaci.com');

    expect(result).toContain('AI-powered store generation');
    expect(result).toContain('https://usebaci.com/onboarding');
  });
});

describe('storefront markdown mirrors', () => {
  it('builds the storefront home markdown', () => {
    const result = buildStorefrontHomeMarkdown(
      merchant,
      'https://ogabassey.com'
    );

    expect(result).toContain('# Ogabassey');
    expect(result).toContain('https://ogabassey.com/sitemap.xml');
    expect(result).toContain('https://ogabassey.com/{category}/{productSlug}');
  });

  it('builds the storefront faq markdown', () => {
    const result = buildStorefrontFaqMarkdown(
      merchant,
      'https://ogabassey.com'
    );

    expect(result).toContain('# FAQ');
    expect(result).toContain('## Do you offer delivery?');
  });

  it('builds category markdown with product markdown links', () => {
    const result = buildCategoryMarkdown(
      merchant,
      'https://ogabassey.com',
      'phones',
      {
        isCollection: false,
        fallbackName: 'Phones',
        fallbackDescription: 'Shop phones.',
        products: [
          {
            id: 'p1',
            name: 'iPhone 15',
            slug: 'iphone-15',
            price: 1000,
            category: 'Phones',
            images: ['https://img.test/iphone.jpg'],
          },
        ],
      }
    );

    expect(result).toContain('# Phones');
    expect(result).toContain('https://ogabassey.com/phones/iphone-15.md');
  });

  it('builds product markdown with canonical details', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
      id: 'p1',
      name: 'iPhone 15',
      slug: 'iphone-15',
      description: 'Flagship smartphone',
      price: 1000,
      category: 'Phones',
      brand: 'Apple',
      stock: 3,
      images: ['https://img.test/iphone.jpg'],
    });

    expect(result).toContain('# iPhone 15');
    expect(result).toContain(
      'Canonical product URL: https://ogabassey.com/phones/iphone-15'
    );
  });

  it('builds product markdown using agent availability for nullable manage_stock', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
      id: 'p1',
      name: 'Legacy Watch',
      slug: 'legacy-watch',
      description: 'Bluetooth smartwatch',
      price: 30600,
      category: 'Accessories',
      stock: 0,
      stock_quantity: 0,
      manage_stock: null,
      images: ['https://img.test/watch.jpg'],
    });

    expect(result).toContain('- Availability: in_stock');
    expect(result).toContain('- inventory_policy: untracked');
    expect(result).toContain('- is_purchasable: true');
    expect(result).toContain('- quantity_available: untracked');
  });

  it('builds product markdown with tracked purchasable inventory', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
      id: 'p2',
      name: 'ThinkPad T14',
      slug: 'thinkpad-t14',
      description: 'Business laptop',
      price: 850000,
      category: 'Laptops',
      stock: 5,
      stock_quantity: 5,
      manage_stock: true,
      images: ['https://img.test/thinkpad.jpg'],
    });

    expect(result).toContain('- inventory_policy: tracked');
    expect(result).toContain('- is_purchasable: true');
    expect(result).toContain('- quantity_available: 5');
  });

  it('builds product markdown with tracked out-of-stock inventory', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
      id: 'p3',
      name: 'Galaxy Watch',
      slug: 'galaxy-watch',
      description: 'Smart watch',
      price: 140000,
      category: 'Smartwatches',
      stock: 0,
      stock_quantity: 0,
      manage_stock: true,
      images: ['https://img.test/watch.jpg'],
    });

    expect(result).toContain('- inventory_policy: tracked');
    expect(result).toContain('- is_purchasable: false');
    expect(result).toContain('- quantity_available: 0');
  });

  it('builds blog index markdown', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      [
        {
          title: 'How to choose a phone',
          slug: 'choose-a-phone',
          excerpt: 'Buyer guide',
          reading_time_minutes: 4,
        },
      ],
      ['Guides']
    );

    expect(result).toContain('# Ogabassey Blog');
    expect(result).toContain('https://ogabassey.com/blog/choose-a-phone.md');
  });

  it('builds blog post markdown', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'How to choose a phone',
        slug: 'choose-a-phone',
        excerpt: 'Buyer guide',
        author_name: 'Editor',
        category: 'Guides',
      }
    );

    expect(result).toContain('# How to choose a phone');
    expect(result).toContain('https://ogabassey.com/blog/choose-a-phone.md');
  });
});
