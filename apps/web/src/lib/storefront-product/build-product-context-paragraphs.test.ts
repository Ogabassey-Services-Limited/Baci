import { describe, expect, it } from 'vitest';
import { buildProductContextParagraphs } from './build-product-context-paragraphs';

describe('buildProductContextParagraphs', () => {
  it('builds factual PDP context copy from product, merchant, and category data', () => {
    expect(
      buildProductContextParagraphs({
        merchantBusinessName: 'Ogabassey',
        categoryName: 'Smartphones',
        displayPriceText: '$950 - $1,050',
        semanticModel: {
          supportLinks: [{ href: '/smartphones', label: 'Shop Smartphones' }],
          guideLinks: [
            {
              href: '/blog/guide',
              title: 'Phone Guide',
              description: 'Phone buying guide',
              kind: 'buyer-guide',
            },
          ],
          alternatives: {
            heading: 'More smartphones',
            cards: [
              {
                title: 'iPhone 15',
                description: 'Apple option',
                href: '/smartphones/iphone-15',
              },
            ],
          },
          sameBrand: {
            heading: 'More Samsung',
            cards: [
              {
                title: 'Samsung Galaxy S24',
                description: 'Samsung option',
                href: '/smartphones/samsung-galaxy-s24',
              },
            ],
          },
          samePrice: null,
        },
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
      'Samsung Galaxy S25 is listed by Ogabassey in Smartphones, with pricing shown on this page as $950 - $1,050. Use this product page to review Open Box condition, compare the key details, and decide whether it fits your budget before checkout.',
      'For buyers comparing Samsung options, use the comparison links, buyer guides, same-brand options and smartphones alternatives on this page to move from Samsung Galaxy S25 to relevant options from Ogabassey. Check the page for current availability, delivery, and checkout options.',
    ]);
  });

  it('falls back cleanly when optional brand, condition, and stock are missing', () => {
    const paragraphs = buildProductContextParagraphs({
      merchantBusinessName: 'Ogabassey',
      categoryName: 'Portable Gaming',
      currentProduct: {
        slug: 'steam-deck',
        name: 'Steam Deck',
        price: 800000,
        stock: 0,
      },
    });

    expect(paragraphs[0]).toContain('review the listed condition');
    expect(paragraphs[0]).toContain('with pricing shown on this page');
    expect(paragraphs[0]).not.toContain('current price');
    expect(paragraphs[1]).toContain('use the visible details on this page');
    expect(paragraphs[1]).not.toContain('related links on this page connect');
    expect(paragraphs[1]).toContain(
      'Check the page for current availability before planning checkout.'
    );
  });
});
