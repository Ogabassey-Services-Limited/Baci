import { describe, expect, it } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import { getStorefrontFaqItems } from '@/lib/llms-markdown-storefront-faq';

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
};

describe('getStorefrontFaqItems', () => {
  it('returns valid structured FAQ items', () => {
    expect(
      getStorefrontFaqItems({
        ...merchant,
        faq_items: [
          { question: 'Do you offer delivery?', answer: 'Yes, nationwide.' },
        ],
      })
    ).toEqual([
      { question: 'Do you offer delivery?', answer: 'Yes, nationwide.' },
    ]);
  });

  it('filters invalid entries out of mixed structured FAQ items', () => {
    const result = getStorefrontFaqItems({
      ...merchant,
      faq_items: [
        { question: 'Valid?', answer: 'Yes.' },
        { question: null, answer: 'No.' },
        { question: 'Also valid?', answer: 'Still yes.' },
      ],
    });

    expect(result).toEqual([
      { question: 'Valid?', answer: 'Yes.' },
      { question: 'Also valid?', answer: 'Still yes.' },
    ]);
  });

  it('falls back to legacy FAQ content when structured items are invalid', () => {
    const result = getStorefrontFaqItems({
      ...merchant,
      faq_items: [{ question: null, answer: 123 }],
      pages: {
        faq: 'Q: Legacy returns?\nA: Yes, within 7 days.',
      },
    });

    expect(result).toEqual([
      {
        question: 'Legacy returns?',
        answer: 'Yes, within 7 days.',
        order: 0,
      },
    ]);
  });

  it('falls back to legacy FAQ content when structured items are empty', () => {
    const result = getStorefrontFaqItems({
      ...merchant,
      faq_items: [],
      pages: {
        faq: 'Q: Legacy delivery?\nA: Same day in Lagos.',
      },
    });

    expect(result).toEqual([
      {
        question: 'Legacy delivery?',
        answer: 'Same day in Lagos.',
        order: 0,
      },
    ]);
  });

  it('parses multiple legacy FAQ entries in order', () => {
    const result = getStorefrontFaqItems({
      ...merchant,
      pages: {
        faq: 'Q: First?\nA: One.\n\nQ: Second?\nA: Two.',
      },
    });

    expect(result).toEqual([
      { question: 'First?', answer: 'One.', order: 0 },
      { question: 'Second?', answer: 'Two.', order: 1 },
    ]);
  });

  it('returns an empty array for malformed legacy FAQ content', () => {
    const result = getStorefrontFaqItems({
      ...merchant,
      pages: {
        faq: 'Q: Missing answer only',
      },
    });

    expect(result).toEqual([]);
  });

  it('returns an empty array without structured or legacy FAQ content', () => {
    expect(getStorefrontFaqItems(merchant)).toEqual([]);
  });
});
