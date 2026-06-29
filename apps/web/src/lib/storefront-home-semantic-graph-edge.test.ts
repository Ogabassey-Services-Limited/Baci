import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/products';
import { buildStorefrontHomeSemanticGraph } from './storefront-home-semantic-graph';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'iphone-17',
    name: 'iPhone 17 Pro Max',
    description: 'Apple flagship phone.',
    status: 'active',
    price: 2500000,
    manage_stock: false,
    stock: 0,
    image: '',
    imageLarge: '',
    imageHint: 'iPhone 17 Pro Max',
    brand: 'Apple',
    gtin: '',
    mpn: '',
    slug: 'iphone-17-pro-max',
    category: 'Smartphones',
    category_slug: 'smartphones',
    ...overrides,
  };
}

const identityGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'OnlineStore', name: 'OgaBassey', url: 'https://ogabassey.com' },
    { '@type': 'Store', name: 'OgaBassey Ikeja', url: 'https://ogabassey.com' },
    { '@type': 'WebSite', name: 'OgaBassey', url: 'https://ogabassey.com' },
  ],
};

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'OgaBassey featured products',
  url: 'https://ogabassey.com',
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: 1,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        item: { '@type': 'Product', name: 'iPhone 17 Pro Max' },
      },
    ],
  },
};

describe('buildStorefrontHomeSemanticGraph edge cases', () => {
  it('keeps product significant links when categories are empty', () => {
    const schema = buildStorefrontHomeSemanticGraph({
      baseUrl: 'https://ogabassey.com',
      categories: [],
      collectionSchema,
      description: 'Shop gadgets in Nigeria.',
      identityGraph,
      merchantName: 'OgaBassey',
      products: [makeProduct()],
    });

    const graph = schema['@graph'];
    const homepage = graph.find(
      (node) => node['@id'] === 'https://ogabassey.com/#homepage'
    );

    expect(
      graph.some(
        (node) => node['@id'] === 'https://ogabassey.com/#category-hubs'
      )
    ).toBe(false);
    expect(homepage?.significantLink).toEqual(
      expect.arrayContaining([
        'https://ogabassey.com/smartphones/iphone-17-pro-max',
      ])
    );
  });

  it('keeps product significant links when the product slug is empty but a canonical URL exists', () => {
    const schema = buildStorefrontHomeSemanticGraph({
      baseUrl: 'https://ogabassey.com',
      categories: [],
      collectionSchema,
      description: 'Shop gadgets in Nigeria.',
      identityGraph,
      merchantName: 'OgaBassey',
      products: [
        makeProduct({
          canonical_url: 'https://ogabassey.com/smartphones/iphone-canonical',
          slug: '',
        }),
      ],
    });

    const graph = schema['@graph'];
    const homepage = graph.find(
      (node) => node['@id'] === 'https://ogabassey.com/#homepage'
    );

    expect(homepage?.significantLink).toEqual(
      expect.arrayContaining([
        'https://ogabassey.com/smartphones/iphone-canonical',
      ])
    );
  });

  it('deduplicates category slugs before emitting category hub links', () => {
    const schema = buildStorefrontHomeSemanticGraph({
      baseUrl: 'https://ogabassey.com',
      categories: [
        { name: 'Smartphones', slug: 'smartphones' },
        { name: 'Phones Duplicate', slug: 'smartphones' },
        { name: 'Laptops', slug: 'laptops' },
      ],
      description: 'Shop gadgets in Nigeria.',
      identityGraph,
      merchantName: 'OgaBassey',
      products: [],
    });

    const graph = schema['@graph'];
    const categoryHubs = graph.find(
      (node) => node['@id'] === 'https://ogabassey.com/#category-hubs'
    ) as { itemListElement?: { item?: Record<string, unknown> }[] };

    expect(
      categoryHubs.itemListElement?.map((entry) => entry.item?.url)
    ).toEqual([
      'https://ogabassey.com/smartphones',
      'https://ogabassey.com/laptops',
    ]);
  });

  it('keeps malformed identity graph entries out of the emitted graph', () => {
    const schema = buildStorefrontHomeSemanticGraph({
      baseUrl: 'https://ogabassey.com',
      categories: [],
      description: 'Shop gadgets in Nigeria.',
      identityGraph: {
        '@context': 'https://schema.org',
        '@graph': ['bad-node', { '@type': 'Thing', name: 'Valid node' }],
      },
      merchantName: 'OgaBassey',
      products: [],
    });

    const graph = schema['@graph'];

    expect(graph).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Valid node' })])
    );
    expect(
      graph.some(
        (node) => node['@id'] === 'https://ogabassey.com/#online-store'
      )
    ).toBe(false);
  });
});
