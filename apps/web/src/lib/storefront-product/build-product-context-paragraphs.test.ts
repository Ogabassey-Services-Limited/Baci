import { describe, expect, it } from 'vitest';
import { buildProductContextParagraphs } from './build-product-context-paragraphs';

describe('buildProductContextParagraphs', () => {
  it('builds factual PDP context copy from product, merchant, and category data', () => {
    expect(
      buildProductContextParagraphs({
        merchantBusinessName: 'Ogabassey',
        categoryName: 'Smartphones',
        countryCode: 'NG',
        currentProduct: {
          slug: 'samsung-galaxy-s25',
          name: 'Samsung Galaxy S25',
          brand: 'Samsung',
          condition: 'open_box',
          price: 950000,
          stock: 3,
          category_slug: 'smartphones',
          product_key_specs: {},
        },
      })
    ).toEqual([
      'Samsung Galaxy S25 is listed by Ogabassey in Smartphones, with the current price shown as ₦950,000. Use this product page to review Open Box condition, compare the key details, and decide whether it fits your budget before checkout.',
      'For buyers comparing Samsung options, the related links on this page connect Samsung Galaxy S25 with same-brand, similar-price, and category alternatives from Ogabassey. Check the page for current availability, delivery, and checkout options.',
    ]);
  });

  it('falls back cleanly when optional brand, condition, and stock are missing', () => {
    const paragraphs = buildProductContextParagraphs({
      merchantBusinessName: 'Ogabassey',
      categoryName: 'Portable Gaming',
      countryCode: 'NG',
      currentProduct: {
        slug: 'steam-deck',
        name: 'Steam Deck',
        price: 800000,
        stock: 0,
      },
    });

    expect(paragraphs[0]).toContain('review the listed condition');
    expect(paragraphs[1]).toContain(
      'For buyers comparing portable gaming alternatives'
    );
    expect(paragraphs[1]).toContain(
      'Check the page for current availability before planning checkout.'
    );
  });
});
