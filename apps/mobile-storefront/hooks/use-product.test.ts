import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import { resolveAndEvictProduct } from '@/hooks/product-utils';
import type { Product } from '@/types/product';
import { usePrefetchProduct, useProduct } from './use-product';

jest.mock('@/hooks/use-merchant', () => ({
  useMerchant: jest.fn(),
}));

jest.mock('@/hooks/product-utils', () => {
  const { normalizeVariantAttributes } = jest.requireActual(
    '@/lib/product-normalization'
  );

  return {
    CONSTANT_MERCHANT_ID: 'merchant-fallback',
    log: {
      info: jest.fn(),
      error: jest.fn(),
    },
    normalizeProductVariants: (
      variants: Array<Record<string, unknown>> | null | undefined,
      options: { basePrice: number; compareAtPrice?: number }
    ) =>
      (variants || []).map((variant) => ({
        id: String(variant.id),
        name:
          (variant.attributes as Record<string, string> | undefined)?.storage ||
          String(variant.sku || 'Variant'),
        sku:
          typeof variant.sku === 'string' ? variant.sku : undefined,
        price:
          typeof variant.price === 'number'
            ? variant.price
            : typeof variant.price_override === 'number'
              ? variant.price_override
              : typeof variant.price_modifier === 'number'
                ? Math.max(0, options.basePrice + variant.price_modifier)
                : options.basePrice,
        compare_at_price:
          typeof variant.compare_at_price === 'number'
            ? variant.compare_at_price
            : options.compareAtPrice,
        price_override:
          typeof variant.price_override === 'number'
            ? variant.price_override
            : undefined,
        price_modifier:
          typeof variant.price_modifier === 'number'
            ? variant.price_modifier
            : undefined,
        image:
          typeof variant.primary_image === 'string'
            ? variant.primary_image
            : typeof variant.image === 'string'
              ? variant.image
              : undefined,
        images: Array.isArray(variant.images)
          ? (variant.images as string[])
          : undefined,
        in_stock:
          typeof variant.stock_quantity === 'number'
            ? variant.stock_quantity > 0
            : typeof variant.in_stock === 'boolean'
              ? variant.in_stock
              : undefined,
        stock_quantity:
          typeof variant.stock_quantity === 'number'
            ? variant.stock_quantity
            : undefined,
        attributes:
          variant.attributes &&
          typeof variant.attributes === 'object' &&
          !Array.isArray(variant.attributes)
            ? (variant.attributes as Record<string, string>)
            : undefined,
      })),
    normalizeVariantAttributes,
    resolveAndEvictProduct: jest.fn(),
    transformProduct: (item: Record<string, unknown>) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      if (
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.slug !== 'string' ||
        typeof item.price !== 'number'
      ) {
        return null;
      }

      const images = Array.isArray(item.images)
        ? item.images.filter(
            (image): image is string =>
              typeof image === 'string' && image.length > 0
          )
        : [];

      const firstCategory = Array.isArray(item.categories)
        ? item.categories[0]
        : item.categories;
      const categoryName =
        firstCategory &&
        typeof firstCategory === 'object' &&
        typeof (firstCategory as { name?: unknown }).name === 'string'
          ? ((firstCategory as { name: string }).name ?? '')
          : '';

      return {
        id: item.id,
        name: item.name,
        slug: item.slug,
        description:
          typeof item.description === 'string' ? item.description : undefined,
        price: item.price,
        compare_at_price:
          typeof item.compare_at_price === 'number'
            ? item.compare_at_price
            : undefined,
        image: images[0] ?? '',
        images,
        brand: typeof item.brand === 'string' ? item.brand : undefined,
        category: categoryName,
        condition: typeof item.condition === 'string' ? item.condition : undefined,
        rating:
          typeof item.average_rating === 'number' ? item.average_rating : undefined,
        review_count: typeof item.review_count === 'number' ? item.review_count : 0,
        manage_stock:
          typeof item.manage_stock === 'boolean' ? item.manage_stock : false,
        colors: Array.isArray(item.colors) ? item.colors : undefined,
        color_images:
          item.color_images &&
          typeof item.color_images === 'object' &&
          !Array.isArray(item.color_images)
            ? item.color_images
            : undefined,
        has_condition_offers:
          typeof item.has_condition_offers === 'boolean'
            ? item.has_condition_offers
            : false,
        offers: Array.isArray(item.offers) ? item.offers : undefined,
        in_stock:
          typeof item.stock_quantity === 'number' ? item.stock_quantity > 0 : true,
      };
    },
  };
});

const mockUseMerchant = useMerchant as jest.MockedFunction<typeof useMerchant>;
const mockResolveAndEvictProduct = resolveAndEvictProduct as jest.MockedFunction<
  typeof resolveAndEvictProduct
>;

const validProductRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'iPhone 13 Pro',
  slug: 'iphone-13-pro',
  description: 'Flagship phone',
  price: 552000,
  compare_at_price: 600000,
  images: ['https://cdn.example.com/iphone-13-pro.jpg'],
  brand: 'Apple',
  color: 'Blue',
  condition: 'New',
  average_rating: 4.6,
  review_count: 18,
  manage_stock: true,
  stock: 4,
  stock_quantity: 4,
  status: 'active',
  specifications: { ram: '6GB' },
  has_variants: true,
  colors: ['Blue'],
  color_images: { Blue: ['https://cdn.example.com/iphone-13-pro-blue.jpg'] },
  has_condition_offers: true,
  offers: [
    {
      id: 'offer-used',
      condition: 'used',
      price: 510000,
      compare_at_price: 540000,
      stock_quantity: 2,
      images: ['https://cdn.example.com/iphone-13-pro-used.jpg'],
      condition_notes: 'Excellent condition',
      grade: 'A',
    },
  ],
  variant_attributes: [{ param: 'Storage', options: ['128GB', '256GB'] }],
  variants: [
    {
      id: 'variant-128gb',
      product_id: '123e4567-e89b-12d3-a456-426614174000',
      merchant_id: 'merchant-1',
      sku: 'IPHONE-13-PRO-128',
      price: 552000,
      compare_at_price: 600000,
      price_override: 552000,
      price_modifier: 0,
      primary_image: 'https://cdn.example.com/iphone-13-pro-128.jpg',
      image: 'https://cdn.example.com/iphone-13-pro-128.jpg',
      images: ['https://cdn.example.com/iphone-13-pro-128.jpg'],
      in_stock: true,
      stock_quantity: 4,
      attributes: { storage: '128GB' },
    },
  ],
  categories: [{ id: 'cat-1', name: 'Phones', slug: 'phones' }],
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useProduct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMerchant.mockReturnValue({
      data: { id: 'merchant-1' },
    } as ReturnType<typeof useMerchant>);
  });

  it('returns an augmented validated product row', async () => {
    mockResolveAndEvictProduct.mockResolvedValue(validProductRow);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useProduct('iphone-13-pro'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.product).not.toBeNull();
    });

    expect(result.current.product).toMatchObject({
      id: validProductRow.id,
      slug: validProductRow.slug,
      has_variants: true,
      rating: validProductRow.average_rating,
      review_count: validProductRow.review_count,
      colors: validProductRow.colors,
      color_images: validProductRow.color_images,
      has_condition_offers: true,
      offers: [
        expect.objectContaining({
          id: 'offer-used',
          condition: 'used',
          price: 510000,
        }),
      ],
      variant_attributes: {
        storage: ['128GB', '256GB'],
      },
      variants: [
        expect.objectContaining({
          id: 'variant-128gb',
          sku: 'IPHONE-13-PRO-128',
          price_override: 552000,
          attributes: { storage: '128GB' },
        }),
      ],
    });
  });

  it('accepts product variants with null sku values', async () => {
    mockResolveAndEvictProduct.mockResolvedValue({
      ...validProductRow,
      variants: [
        {
          ...validProductRow.variants[0],
          sku: null,
        },
      ],
    });
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useProduct('iphone-13-pro'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.product).not.toBeNull();
    });

    expect(result.current.product?.variants).toEqual([
      expect.objectContaining({
        id: 'variant-128gb',
        sku: undefined,
        name: '128GB',
      }),
    ]);
  });

  it('preserves non-storage variant axes like ram for selector rendering', async () => {
    mockResolveAndEvictProduct.mockResolvedValue({
      ...validProductRow,
      variant_attributes: {
        storage: ['256GB', '512GB'],
        ram: ['8GB', '16GB'],
      },
      variants: [
        {
          ...validProductRow.variants[0],
          attributes: { storage: '256GB', ram: '8GB' },
        },
      ],
    });
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useProduct('iphone-13-pro'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.product).not.toBeNull();
    });

    expect(result.current.product).toMatchObject({
      variant_attributes: {
        storage: ['256GB', '512GB'],
        ram: ['8GB', '16GB'],
      },
      variants: [
        expect.objectContaining({
          attributes: { storage: '256GB', ram: '8GB' },
        }),
      ],
    });
  });

  it('hydrates from any matching cached products query key', () => {
    const queryClient = createQueryClient();
    const cachedProduct: Product = {
      id: 'cached-1',
      name: 'Cached Pixel 8',
      slug: 'pixel-8',
      price: 420000,
      image: 'https://cdn.example.com/pixel-8.jpg',
      images: ['https://cdn.example.com/pixel-8.jpg'],
      has_variants: false,
    };

    queryClient.setQueryData(['products', 'merchant-1', { search: 'pixel' }], {
      pages: [{ products: [cachedProduct], nextOffset: null, total: 1 }],
    });
    mockResolveAndEvictProduct.mockResolvedValue(validProductRow);

    const { result } = renderHook(() => useProduct('pixel-8'), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.product?.id).toBe('cached-1');
  });

  it('normalizes cached initial variants with the same shape as fetched products', () => {
    const queryClient = createQueryClient();
    const cachedProduct: Product = {
      id: 'cached-2',
      name: 'Cached ThinkPad',
      slug: 'cached-thinkpad',
      price: 1000,
      compare_at_price: 1200,
      image: 'https://cdn.example.com/thinkpad.jpg',
      images: ['https://cdn.example.com/thinkpad.jpg'],
      has_variants: true,
      variants: [
        {
          id: 'variant-ram',
          name: 'Legacy name',
          price: 1200,
          price_override: 1200,
          attributes: { ram: '16GB' },
        },
      ],
    };

    queryClient.setQueryData(['products', 'merchant-1', { search: 'thinkpad' }], {
      pages: [{ products: [cachedProduct], nextOffset: null, total: 1 }],
    });

    const { result } = renderHook(() => useProduct('cached-thinkpad'), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.product?.variants).toEqual([
      expect.objectContaining({
        id: 'variant-ram',
        price: 1200,
        compare_at_price: 1200,
        attributes: { ram: '16GB' },
      }),
    ]);
  });

  it('returns validation errors for malformed product rows', async () => {
    mockResolveAndEvictProduct.mockResolvedValue({
      id: 'not-a-uuid',
      slug: 'bad-product',
    } as never);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useProduct('bad-product'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.error).toContain('Product validation failed');
    });
    expect(result.current.product).toBeNull();
  });
});

describe('usePrefetchProduct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMerchant.mockReturnValue({
      data: { id: 'merchant-1' },
    } as ReturnType<typeof useMerchant>);
  });

  it('prefetches and stores validated product data', async () => {
    mockResolveAndEvictProduct.mockResolvedValue(validProductRow);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => usePrefetchProduct(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current('iphone-13-pro');
    });

    expect(
      queryClient.getQueryData(['product', 'iphone-13-pro', 'merchant-1'])
    ).toMatchObject({
      id: validProductRow.id,
      slug: validProductRow.slug,
      variant_attributes: {
        storage: ['128GB', '256GB'],
      },
      variants: [
        expect.objectContaining({
          id: 'variant-128gb',
          sku: 'IPHONE-13-PRO-128',
          price_override: 552000,
          attributes: { storage: '128GB' },
        }),
      ],
    });
  });

  it('does not populate cache when prefetch validation fails', async () => {
    mockResolveAndEvictProduct.mockResolvedValue({
      id: 'bad-id',
      slug: 'bad-product',
    } as never);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => usePrefetchProduct(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current('bad-product');
    });

    expect(
      queryClient.getQueryData(['product', 'bad-product', 'merchant-1'])
    ).toBeUndefined();
  });
});
