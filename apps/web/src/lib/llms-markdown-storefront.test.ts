import { describe, expect, it } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import {
  buildCategoryMarkdown,
  buildProductMarkdown,
  buildStorefrontAboutMarkdown,
  buildStorefrontContactMarkdown,
  buildStorefrontFaqMarkdown,
  buildStorefrontHomeMarkdown,
} from '@/lib/llms-markdown-storefront';

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

describe('llms markdown storefront builders', () => {
  it('builds the storefront home mirror', () => {
    const home = buildStorefrontHomeMarkdown(merchant, 'https://ogabassey.com');

    expect(home).toContain('https://ogabassey.com/sitemap.xml');
    expect(home).toContain('https://ogabassey.com/{category}/{productSlug}');
  });

  it('normalizes trailing slashes in storefront home routes', () => {
    const home = buildStorefrontHomeMarkdown(
      merchant,
      'https://ogabassey.com/'
    );

    expect(home).toContain('https://ogabassey.com/sitemap.xml');
    expect(home).toContain('https://ogabassey.com/{category}/{productSlug}');
    expect(home).not.toContain('https://ogabassey.com//');
  });

  it('normalizes trailing slashes across storefront markdown builders', () => {
    const origin = 'https://ogabassey.com/';
    const product = {
      id: 'p6',
      name: 'USB Cable',
      slug: 'usb-cable',
      description: 'Braided cable.',
      price: 6000,
      category: 'Accessories',
      stock: 2,
      stock_quantity: 2,
      manage_stock: true,
      images: [],
    };

    const [
      aboutMarkdown,
      contactMarkdown,
      faqMarkdown,
      categoryMarkdown,
      productMarkdown,
    ] = [
      buildStorefrontAboutMarkdown(merchant, origin),
      buildStorefrontContactMarkdown(merchant, origin),
      buildStorefrontFaqMarkdown(merchant, origin),
      buildCategoryMarkdown(merchant, origin, 'accessories', {
        isCollection: true,
        name: 'Accessories',
        products: [product],
      }),
      buildProductMarkdown(merchant, origin, product),
    ];

    for (const result of [
      aboutMarkdown,
      contactMarkdown,
      faqMarkdown,
      categoryMarkdown,
      productMarkdown,
    ]) {
      expect(result).not.toContain('https://ogabassey.com//');
    }

    expect(aboutMarkdown).toContain('Canonical host: https://ogabassey.com');
    expect(contactMarkdown).toContain('Canonical host: https://ogabassey.com');
    expect(faqMarkdown).toContain('Canonical host: https://ogabassey.com');
    expect(contactMarkdown).toContain('https://ogabassey.com/contact');
    expect(categoryMarkdown).toContain('https://ogabassey.com/accessories');
    expect(productMarkdown).toContain(
      'https://ogabassey.com/accessories/usb-cable'
    );
  });

  it('builds the storefront FAQ mirror', () => {
    const faq = buildStorefrontFaqMarkdown(merchant, 'https://ogabassey.com');

    expect(faq).toContain('## Do you offer delivery?');
  });

  it('handles merchants without FAQ items', () => {
    const result = buildStorefrontFaqMarkdown(
      { ...merchant, faq_items: [] },
      'https://ogabassey.com'
    );

    expect(result).toContain('# FAQ');
    expect(result).not.toContain('## Do you offer delivery?');
  });

  it('falls back to legacy FAQ when structured FAQ items are invalid', () => {
    const result = buildStorefrontFaqMarkdown(
      {
        ...merchant,
        faq_items: [{ question: null, answer: 123 }],
        pages: {
          faq: 'Q: Legacy returns?\nA: Yes, within 7 days.',
        },
      },
      'https://ogabassey.com'
    );

    expect(result).toContain('## Legacy returns?');
    expect(result).toContain('Yes, within 7 days.');
  });

  it('sanitizes merchant-controlled storefront markdown fields', () => {
    const result = buildStorefrontHomeMarkdown(
      {
        ...merchant,
        business_name:
          '<script>alert(1)</script>Bad [Store](javascript:alert(1))',
        site_description: '<img src=x onerror=alert(1)> **unsafe**',
        business_type: '<b>Retail</b>',
        phone: '<script>bad</script>+2348000000000',
        email: '<b>hello@ogabassey.com</b>',
      },
      'https://ogabassey.com'
    );

    expect(result).not.toContain('<script');
    expect(result).not.toContain('[Store](javascript');
    expect(result).not.toContain('**unsafe**');
    expect(result).toContain('unsafe');
    expect(result).toContain('Retail');
    expect(result).toContain('hello@ogabassey.com');
  });

  it('uses agent availability for nullable manage_stock product markdown', () => {
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

  it('treats omitted manage_stock as unmanaged stock', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
      id: 'p2',
      name: 'Legacy Phone',
      slug: 'legacy-phone',
      description: 'Older catalog row without explicit stock management.',
      price: 120000,
      category: 'Phones',
      stock: 0,
      stock_quantity: 0,
      images: [],
    });

    expect(result).toContain(
      '> Older catalog row without explicit stock management.'
    );
    expect(result).toContain('- Availability: in_stock');
    expect(result).toContain('- quantity_available: untracked');
    expect(result).toContain('https://placehold.co/400x400');
  });

  it('sanitizes product-controlled markdown fields', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
      id: 'p5',
      name: '<script>alert(1)</script>[Phone](javascript:alert(1))',
      slug: 'unsafe-phone',
      description: '<img src=x onerror=alert(1)> **unsafe** phone',
      price: 180000,
      category: '<b>Phones</b>',
      brand: '[BadBrand](javascript:alert(1))',
      condition: '<i>new</i>',
      stock: 5,
      stock_quantity: 5,
      manage_stock: true,
      images: ['https://img.test/phone.jpg'],
    });

    expect(result).not.toContain('<script');
    expect(result).not.toContain('[Phone](javascript');
    expect(result).not.toContain('[BadBrand](javascript');
    expect(result).not.toContain('**unsafe**');
    expect(result).toContain('unsafe');
    expect(result).toContain('Phones');
    expect(result).toContain('new');
  });

  it.each([
    {
      label: 'tracked out-of-stock',
      product: {
        id: 'p3',
        name: 'Sold Out Watch',
        slug: 'sold-out-watch',
        description: 'Tracked inventory item.',
        price: 95000,
        category: 'Accessories',
        stock: 0,
        stock_quantity: 0,
        manage_stock: true,
        images: [],
      },
      expected: [
        '- Availability: out_of_stock',
        '- is_purchasable: false',
        '- quantity_available: 0',
      ],
    },
    {
      label: 'tracked in-stock',
      product: {
        id: 'p4',
        name: 'Available Watch',
        slug: 'available-watch',
        description: 'Tracked inventory item.',
        price: 125000,
        category: 'Accessories',
        stock: 4,
        stock_quantity: 4,
        manage_stock: true,
        images: [],
      },
      expected: [
        '- Availability: in_stock',
        '- is_purchasable: true',
        '- quantity_available: 4',
      ],
    },
  ])('renders $label product metadata', ({ product, expected }) => {
    const result = buildProductMarkdown(
      merchant,
      'https://ogabassey.com',
      product
    );

    for (const expectedLine of expected) {
      expect(result).toContain(expectedLine);
    }
  });
});
