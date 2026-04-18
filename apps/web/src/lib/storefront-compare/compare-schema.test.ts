import { describe, expect, it } from 'vitest';
import {
  buildComparePageSchemas,
  buildPriceBandPageSchemas,
} from './compare-schema';

describe('buildComparePageSchemas', () => {
  it('builds breadcrumb and faq schema objects for compare pages', () => {
    const schemas = buildComparePageSchemas({
      breadcrumbItems: [
        { name: 'Ogabassey', url: 'https://ogabassey.com' },
        { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
      ],
      faqItems: [
        {
          question: 'Which phone is better?',
          answer: 'It depends on the buyer.',
        },
      ],
    });

    expect(schemas.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(schemas.faq?.['@type']).toBe('FAQPage');
  });
});

describe('buildPriceBandPageSchemas', () => {
  it('builds breadcrumb and ItemList schema objects for price-band pages', () => {
    const schemas = buildPriceBandPageSchemas({
      breadcrumbItems: [
        { name: 'Ogabassey', url: 'https://ogabassey.com' },
        { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
      ],
      pageName: 'Best Smartphones Under ₦500,000',
      pageUrl: 'https://ogabassey.com/smartphones/best-under/under-500k',
      currency: 'NGN',
      products: [
        {
          id: 'product-c',
          slug: 'galaxy-a56',
          name: 'Galaxy A56',
          category: 'Smartphones',
          category_slug: 'smartphones',
          price: 480_000,
          image: 'https://cdn.example.com/a56.jpg',
          availability: 'OutOfStock',
          description: '<p>Best <strong>midrange</strong> pick</p>',
        },
      ],
    });

    expect(schemas.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(schemas.itemList['@type']).toBe('ItemList');
    expect(
      (
        schemas.itemList.itemListElement as Array<{
          item: { offers: { availability: string }; description: string };
        }>
      )[0]?.item.offers.availability
    ).toBe('https://schema.org/OutOfStock');
    expect(
      (
        schemas.itemList.itemListElement as Array<{
          item: { offers: { availability: string }; description: string };
        }>
      )[0]?.item.description
    ).toBe('Best midrange pick');
  });
});
