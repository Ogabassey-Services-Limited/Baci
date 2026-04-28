import { describe, expect, it } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import {
  buildProductMarkdown,
  buildStorefrontFaqMarkdown,
  buildStorefrontHomeMarkdown,
} from './llms-markdown-storefront';

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

  it('renders tracked out-of-stock product metadata', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
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
    });

    expect(result).toContain('- Availability: out_of_stock');
    expect(result).toContain('- is_purchasable: false');
    expect(result).toContain('- quantity_available: 0');
  });

  it('renders tracked in-stock product metadata', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
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
    });

    expect(result).toContain('- Availability: in_stock');
    expect(result).toContain('- is_purchasable: true');
    expect(result).toContain('- quantity_available: 4');
  });
});
