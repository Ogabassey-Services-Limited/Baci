import { describe, expect, it } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import {
  buildCategoryMarkdown,
  buildProductMarkdown,
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
  payout_currency: 'NGN',
  slug: 'ogabassey',
  business_address: 'Lagos, Nigeria',
  is_published: true,
  template_id: 'tpl-1',
  plan_tier: 'pro',
  premium_features: null,
};

const joinedAccessoriesCategory = {
  id: 'category-accessories',
  name: 'Accessories',
  slug: 'accessories',
};

describe('llms storefront canonical parity', () => {
  it('uses the joined category path instead of a stale canonical URL in category markdown', () => {
    const result = buildCategoryMarkdown(
      merchant,
      'https://ogabassey.com',
      'accessories',
      {
        isCollection: false,
        fallbackName: 'Accessories',
        fallbackDescription: 'Shop accessories.',
        products: [
          {
            id: 'p1',
            name: 'Riversong Motive 5T Smart Watch',
            slug: 'riversong-motive-5t-smart-watch',
            canonical_url: '/smartwatches/riversong-motive-5t-smart-watch',
            categories: joinedAccessoriesCategory,
            price: 30_600,
            category: 'Accessories',
            images: ['https://img.test/watch.jpg'],
          },
        ],
      }
    );

    expect(result).toContain(
      'https://ogabassey.com/accessories/riversong-motive-5t-smart-watch.md'
    );
    expect(result).not.toContain(
      'https://ogabassey.com/smartwatches/riversong-motive-5t-smart-watch.md'
    );
  });

  it('uses the joined category path in product markdown purchase metadata', () => {
    const result = buildProductMarkdown(merchant, 'https://ogabassey.com', {
      id: 'p1',
      name: 'Riversong Motive 5T Smart Watch',
      slug: 'riversong-motive-5t-smart-watch',
      canonical_url: '/smartwatches/riversong-motive-5t-smart-watch',
      categories: joinedAccessoriesCategory,
      description: 'Bluetooth smartwatch',
      price: 30_600,
      category: 'Accessories',
      stock: 0,
      stock_quantity: 0,
      manage_stock: false,
      images: ['https://img.test/watch.jpg'],
    });

    expect(result).toContain(
      'Canonical product URL: https://ogabassey.com/accessories/riversong-motive-5t-smart-watch'
    );
    expect(result).toContain(
      'Markdown mirror: https://ogabassey.com/accessories/riversong-motive-5t-smart-watch.md'
    );
  });
});
