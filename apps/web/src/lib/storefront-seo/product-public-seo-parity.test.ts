import { describe, expect, it } from 'vitest';
import { buildProductSitemapEntry } from '@/app/(storefront)/[slug]/build-product-sitemap-entry';
import { generateGoogleMerchantFeed } from '@/app/api/feed/google-merchant/feed-builder';
import { buildOgabasseyPdpCriticalProduct } from '@/components/storefront/ogabassey/pdp/critical-product';
import { generateProductSchema, getValidatedProductUrl } from '@/lib/seo-utils';
import { buildProductSeoDecision } from './build-product-seo-decision';
import { toProductIndexingFacts } from './to-product-indexing-facts';

describe('product public SEO parity', () => {
  it('does not publish a blank-name product to either the page index or feed', () => {
    const pageDecision = buildProductSeoDecision(
      toProductIndexingFacts({
        isStorePublished: true,
        status: 'active',
        name: ' ',
        canonicalUrl: 'https://zorvexa.usebaci.com/products/product-1',
      })
    );
    const feed = generateGoogleMerchantFeed(
      [
        {
          id: 'product-1',
          name: ' ',
          description: 'Description',
          price: 10_000,
          stock: 1,
        },
      ],
      { id: 'merchant-1', business_name: 'Zorvexa', slug: 'zorvexa' },
      'https://zorvexa.usebaci.com',
      {
        'product-1': [
          {
            verified_url: 'https://cdn.example.com/product-1.jpg',
            verified_format: 'jpeg',
            status: 'verified',
            is_primary: true,
            position: 0,
          },
        ],
      }
    );

    expect(pageDecision.index).toBe(false);
    expect(feed).not.toContain('<g:id>product-1</g:id>');
  });

  it.each([
    { stock: 3, feedAvailability: 'in_stock', schemaAvailability: 'InStock' },
    {
      stock: 0,
      feedAvailability: 'out_of_stock',
      schemaAvailability: 'OutOfStock',
    },
  ])('keeps in-stock and out-of-stock public facts aligned ($feedAvailability)', ({
    stock,
    feedAvailability,
    schemaAvailability,
  }) => {
    const baseUrl = 'https://zorvexa.usebaci.com';
    const product = {
      id: `product-${stock}`,
      name: 'Linen Shirt',
      description: 'Breathable linen shirt.',
      slug: 'linen-shirt',
      canonical_url: null,
      category: 'Fashion',
      categories: { slug: 'fashion', name: 'Fashion' },
      images: ['https://cdn.example.com/linen-shirt.jpg'],
      price: 12_000,
      stock,
      stock_quantity: stock,
      manage_stock: true,
      condition: 'new' as const,
      updated_at: undefined,
    };
    const canonicalUrl = `${baseUrl}/fashion/linen-shirt`;
    const visibleProduct = buildOgabasseyPdpCriticalProduct(product);
    const visibleCanonicalUrl = getValidatedProductUrl(
      product,
      baseUrl,
      'zorvexa'
    );
    const schema = generateProductSchema(
      product as never,
      'Zorvexa',
      'NGN',
      'NG',
      undefined,
      undefined,
      { productUrl: canonicalUrl }
    );
    const sitemap = buildProductSitemapEntry({
      product: { ...product, updated_at: null },
      storeUrl: baseUrl,
    });
    const feed = generateGoogleMerchantFeed(
      [product],
      { id: 'merchant-1', business_name: 'Zorvexa', slug: 'zorvexa' },
      baseUrl,
      {
        [product.id]: [
          {
            verified_url: 'https://cdn.example.com/linen-shirt.jpg',
            verified_format: 'jpeg',
            status: 'verified',
            is_primary: true,
            position: 0,
          },
        ],
      }
    );
    const pageDecision = buildProductSeoDecision(
      toProductIndexingFacts({
        isStorePublished: true,
        status: 'active',
        name: product.name,
        canonicalUrl,
      })
    );

    expect(pageDecision.index).toBe(true);
    expect(visibleProduct).toMatchObject({
      name: product.name,
      image: 'https://cdn.example.com/linen-shirt.jpg',
      price: product.price,
      condition: 'new',
      stockQuantity: stock,
    });
    expect(visibleCanonicalUrl).toBe(canonicalUrl);
    expect(sitemap.url).toBe(canonicalUrl);
    expect(sitemap.images).toEqual(['https://cdn.example.com/linen-shirt.jpg']);
    expect(schema).toMatchObject({
      name: product.name,
      url: canonicalUrl,
      image: ['https://cdn.example.com/linen-shirt.jpg'],
      offers: expect.objectContaining({
        price: product.price,
        priceCurrency: 'NGN',
        availability: `https://schema.org/${schemaAvailability}`,
        itemCondition: 'https://schema.org/NewCondition',
      }),
    });
    expect(feed).toContain(`<g:link>${canonicalUrl}</g:link>`);
    expect(feed).toContain(
      '<g:image_link>https://cdn.example.com/linen-shirt.jpg</g:image_link>'
    );
    expect(feed).toContain('<g:price>12000.00 NGN</g:price>');
    expect(feed).toContain(
      `<g:availability>${feedAvailability}</g:availability>`
    );
    expect(feed).toContain('<g:condition>new</g:condition>');
  });

  it('keeps a stale stored canonical from splitting PDP, sitemap, schema, and Google feed URLs', () => {
    const baseUrl = 'https://zorvexa.usebaci.com';
    const expectedUrl = `${baseUrl}/fashion/linen-shirt`;
    const product = {
      id: 'product-stale-canonical',
      name: 'Linen Shirt',
      description: 'Breathable linen shirt.',
      slug: 'linen-shirt',
      canonical_url: '/old/linen-shirt',
      category: 'Fashion',
      categories: { slug: 'fashion', name: 'Fashion' },
      images: ['https://cdn.example.com/linen-shirt.jpg'],
      price: 12_000,
      stock: 3,
      stock_quantity: 3,
      manage_stock: true,
      condition: 'new' as const,
      updated_at: undefined,
    };
    const visibleCanonicalUrl = getValidatedProductUrl(
      product,
      baseUrl,
      'zorvexa'
    );
    const schema = generateProductSchema(
      product as never,
      'Zorvexa',
      'NGN',
      'NG',
      undefined,
      undefined,
      { productUrl: expectedUrl }
    );
    const sitemap = buildProductSitemapEntry({
      product: { ...product, updated_at: null },
      storeUrl: baseUrl,
    });
    const feed = generateGoogleMerchantFeed(
      [product],
      { id: 'merchant-1', business_name: 'Zorvexa', slug: 'zorvexa' },
      baseUrl,
      {
        [product.id]: [
          {
            verified_url: 'https://cdn.example.com/linen-shirt.jpg',
            verified_format: 'jpeg',
            status: 'verified',
            is_primary: true,
            position: 0,
          },
        ],
      }
    );

    expect(visibleCanonicalUrl).toBe(expectedUrl);
    expect(sitemap.url).toBe(expectedUrl);
    expect(schema.url).toBe(expectedUrl);
    expect(feed).toContain(`<g:link>${expectedUrl}</g:link>`);
    expect(feed).not.toContain(
      '<g:link>https://zorvexa.usebaci.com/old/linen-shirt</g:link>'
    );
  });
});
