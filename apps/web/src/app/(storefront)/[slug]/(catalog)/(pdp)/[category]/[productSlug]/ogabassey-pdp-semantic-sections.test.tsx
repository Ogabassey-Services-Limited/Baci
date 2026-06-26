import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { OgabasseyPdpSemanticSections } from './ogabassey-pdp-semantic-sections';

type SemanticModel = {
  contextParagraphs?: string[];
  trustBullets: string[];
  supportLinks: unknown[];
  guideLinks: unknown[];
  alternatives: null;
  sameBrand: null;
  samePrice: null;
};

const mockGetCachedProductSeoLinkData = vi.fn();
const mockBuildProductSemanticModel =
  vi.fn<(input: unknown) => SemanticModel>();
const mockProductSemanticSections = vi.fn(
  ({ model }: { model: SemanticModel }) => (
    <section aria-label="semantic sections">
      {model.trustBullets.join(' | ')}
      {model.contextParagraphs?.join(' | ')}
    </section>
  )
);

vi.mock('@/lib/storefront-product/get-cached-product-seo-link-data', () => ({
  getCachedProductSeoLinkData: (...args: unknown[]) =>
    mockGetCachedProductSeoLinkData(...args),
}));

vi.mock('@/lib/storefront-product/build-product-semantic-model', () => ({
  buildProductSemanticModel: (input: unknown) =>
    mockBuildProductSemanticModel(input),
}));

vi.mock(
  '@/components/storefront/ogabassey/seo/product-semantic-sections',
  () => ({
    ProductSemanticSections: (props: { model: SemanticModel }) =>
      mockProductSemanticSections(props),
  })
);

const product = {
  id: 'prod-1',
  slug: 'lenovo-legion',
  name: 'Lenovo Legion',
  brand: 'Lenovo',
  condition: 'new',
  price: 3500000,
  stock: 4,
  category_slug: 'laptops',
  product_key_specs: { ram_gb: 32 },
} as Product;

describe('OgabasseyPdpSemanticSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedProductSeoLinkData.mockResolvedValue({
      inventory: [
        {
          slug: 'macbook-pro',
          name: 'MacBook Pro',
          brand: 'Apple',
          price: 4500000,
          stock: 2,
          category_slug: 'laptops',
          product_key_specs: { ram_gb: 18 },
        },
      ],
      guidePosts: [
        { slug: 'lenovo-legion-guide', title: 'Lenovo Legion Guide' },
        { slug: 'best-laptops', title: 'Best laptops' },
      ],
      priorityGuidePostSlugs: ['lenovo-legion-guide'],
    });
    mockBuildProductSemanticModel.mockReturnValue({
      trustBullets: ['Model trust bullet'],
      supportLinks: [],
      guideLinks: [],
      alternatives: null,
      sameBrand: null,
      samePrice: null,
    });
  });

  it('builds semantic sections from deferred category inventory and guide posts', async () => {
    render(
      await OgabasseyPdpSemanticSections({
        categoryName: 'Laptops',
        categorySlug: 'laptops',
        merchant: {
          id: 'merchant-1',
          business_name: 'OgaBassey',
          country: 'NG',
          payout_currency: 'USD',
        },
        product,
        storeSlug: 'ogabassey',
        storeUrl: 'https://ogabassey.com',
      })
    );

    expect(mockGetCachedProductSeoLinkData).toHaveBeenCalledWith(
      'merchant-1',
      'laptops',
      'ogabassey',
      'prod-1'
    );
    expect(mockBuildProductSemanticModel).toHaveBeenCalledWith(
      expect.objectContaining({
        categorySlug: 'laptops',
        currentProduct: expect.objectContaining({ slug: 'lenovo-legion' }),
        guidePosts: [
          { slug: 'lenovo-legion-guide', title: 'Lenovo Legion Guide' },
          { slug: 'best-laptops', title: 'Best laptops' },
        ],
        priorityGuidePostSlugs: ['lenovo-legion-guide'],
        inventory: [
          expect.objectContaining({
            slug: 'macbook-pro',
            category_slug: 'laptops',
          }),
        ],
        storeUrl: 'https://ogabassey.com',
      })
    );
    // Trust bullets ("Buying context") were removed from the PDP; the model is
    // passed through as built, with no merchant-trust-bullet merge.
    expect(screen.getByLabelText('semantic sections')).toHaveTextContent(
      'Model trust bullet'
    );
    expect(screen.getByLabelText('semantic sections')).toHaveTextContent(
      'Lenovo Legion is listed by OgaBassey in Laptops'
    );
    expect(screen.getByLabelText('semantic sections').textContent).toMatch(
      /US\$3,500,000|\$3,500,000/
    );
    expect(screen.getByLabelText('semantic sections')).not.toHaveTextContent(
      '₦3,500,000'
    );
    expect(mockProductSemanticSections).toHaveBeenCalledWith({
      model: expect.objectContaining({
        contextParagraphs: expect.arrayContaining([
          expect.stringContaining(
            'Lenovo Legion is listed by OgaBassey in Laptops'
          ),
        ]),
      }),
    });
  });

  it('returns no semantic sections when the strict server fetch fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected warning noise for this server-side fallback path.
    });
    mockGetCachedProductSeoLinkData.mockRejectedValueOnce(
      new Error('transient inventory failure')
    );

    const result = await OgabasseyPdpSemanticSections({
      categoryName: 'Laptops',
      categorySlug: 'laptops',
      merchant: {
        id: 'merchant-1',
        business_name: 'OgaBassey',
      },
      product,
      storeSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
    });

    expect(result).toBeNull();
    expect(mockBuildProductSemanticModel).not.toHaveBeenCalled();
    expect(mockProductSemanticSections).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load Ogabassey PDP semantic links',
      expect.objectContaining({
        categorySlug: 'laptops',
        merchantId: 'merchant-1',
        productId: 'prod-1',
      })
    );

    warnSpy.mockRestore();
  });
});
