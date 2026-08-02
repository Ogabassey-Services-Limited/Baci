import { describe, expect, it } from 'vitest';
import { buildCategoryProductMetadata } from './category-product-metadata';

describe('buildCategoryProductMetadata', () => {
  it('keeps the existing canonical product metadata shape', () => {
    const metadata = buildCategoryProductMetadata({
      baseUrl: 'https://zorvexa.usebaci.com',
      merchant: {
        business_name: 'Zorvexa',
        country: 'NG',
        slug: 'zorvexa',
      },
      product: {
        name: 'Linen Shirt',
        slug: 'linen-shirt',
        description: 'A breathable linen shirt for warm days.',
        meta_description: null,
        meta_title: null,
        category: 'Fashion',
        categories: { name: 'Fashion', slug: 'fashion' },
        price: 12_000,
        images: ['https://cdn.example.com/linen-shirt.jpg'],
      },
      storeSlug: 'zorvexa',
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical: 'https://zorvexa.usebaci.com/fashion/linen-shirt',
      },
      robots: { index: true, follow: true },
      openGraph: {
        url: 'https://zorvexa.usebaci.com/fashion/linen-shirt',
      },
    });
  });
});
