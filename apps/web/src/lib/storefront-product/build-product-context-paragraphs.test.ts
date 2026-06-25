import { describe, expect, it } from 'vitest';
import { buildProductContextParagraphs } from './build-product-context-paragraphs';
import type { BuildProductSemanticModelInput } from './product-semantic-types';

function makeInput(
  overrides: Partial<BuildProductSemanticModelInput> = {}
): BuildProductSemanticModelInput {
  return {
    storeUrl: 'https://ogabassey.com',
    merchantBusinessName: 'Ogabassey',
    categorySlug: 'playstation-5',
    categoryName: 'PlayStation 5',
    currentProduct: {
      slug: 'forspoken',
      name: 'Forspoken',
      price: 42_000,
      brand: 'Square Enix',
      condition: 'new',
      stock: 5,
      category_slug: 'playstation-5',
      product_key_specs: {
        platform: 'PlayStation 5',
        format: 'Physical Blu-ray disc',
        region: 'Confirm from retail box',
      },
    },
    inventory: [],
    ...overrides,
  };
}

describe('buildProductContextParagraphs', () => {
  it('builds factual PDP context copy from product, merchant, category, and link data', () => {
    expect(
      buildProductContextParagraphs({
        storeUrl: 'https://ogabassey.com',
        merchantBusinessName: 'Ogabassey',
        categorySlug: 'smartphones',
        categoryName: 'Smartphones',
        displayPriceText: '$950 - $1,050',
        inventory: [],
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
          price: 950_000,
          stock: 3,
          category_slug: 'smartphones',
          product_key_specs: {},
        },
      })
    ).toEqual([
      'Samsung Galaxy S25 is listed by Ogabassey in Smartphones, with pricing shown on this page as $950 - $1,050. Use this product page to review Open Box condition, compare the exact item details, and verify practical purchase details before checkout. Live stock, selected options and delivery timing should still be confirmed at checkout.',
      'For buyers comparing Samsung options, use the comparison links, buyer guides, same-brand options and smartphones alternatives on this page to move from Samsung Galaxy S25 to relevant options from Ogabassey. For Smartphones products, confirm the exact model, color, storage or size option, network or device compatibility, charging requirements, included accessories and warranty terms. Audio, TV, phone and smartwatch variants can differ by region, so the final checkout selection should match the retail unit you intend to receive.',
    ]);
  });

  it('falls back cleanly when optional brand, condition, stock, and display price are missing', () => {
    const paragraphs = buildProductContextParagraphs({
      storeUrl: 'https://ogabassey.com',
      merchantBusinessName: 'Ogabassey',
      categorySlug: 'portable-gaming',
      categoryName: 'Portable Gaming',
      inventory: [],
      currentProduct: {
        slug: 'steam-deck',
        name: 'Steam Deck',
        price: 800_000,
        stock: 0,
      },
    });

    expect(paragraphs[0]).toContain('review the listed condition');
    expect(paragraphs[0]).toContain('with pricing shown on this page');
    expect(paragraphs[0]).not.toContain('current price');
    expect(paragraphs[0]).toContain('may currently be out of stock');
    expect(paragraphs[1]).toContain('use the visible details on this page');
    expect(paragraphs[1]).toContain('region compatibility');
    expect(paragraphs[1]).not.toContain('related links on this page connect');
  });

  it('builds product-specific gaming context without fixed price claims', () => {
    const paragraphs = buildProductContextParagraphs(makeInput());

    expect(paragraphs).toHaveLength(3);
    expect(paragraphs.join(' ')).toContain('Forspoken');
    expect(paragraphs.join(' ')).toContain('Ogabassey');
    expect(paragraphs.join(' ')).toContain('region compatibility');
    expect(paragraphs.join(' ')).toContain('format: Physical Blu-ray disc');
    expect(paragraphs.join(' ')).not.toMatch(/price in nigeria|installment/i);
  });

  it('uses computer-specific buyer checks for laptop and monitor categories', () => {
    const paragraphs = buildProductContextParagraphs(
      makeInput({
        categorySlug: 'gaming-laptops',
        categoryName: 'Gaming Laptops',
        currentProduct: {
          slug: 'legion-pro-5',
          name: 'Lenovo Legion Pro 5',
          price: 1_000_000,
          brand: 'Lenovo',
          condition: 'open_box',
          stock: 1,
          category_slug: 'gaming-laptops',
          product_key_specs: {
            processor: 'AMD Ryzen 7',
            ram_gb: '32GB',
            storage_gb: '1TB',
          },
        },
      })
    );

    expect(paragraphs.join(' ')).toContain('processor or panel class');
    expect(paragraphs.join(' ')).toContain('RAM: 32GB');
    expect(paragraphs.join(' ')).toContain('storage: 1TB');
  });
});
