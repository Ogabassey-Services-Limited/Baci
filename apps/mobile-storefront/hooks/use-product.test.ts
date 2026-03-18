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
  condition: 'New',
  average_rating: 4.6,
  review_count: 18,
  manage_stock: true,
  stock_quantity: 4,
  status: 'active',
  specifications: { ram: '6GB' },
  has_variants: true,
  variant_attributes: [{ param: 'Storage', options: ['128GB', '256GB'] }],
  variants: [
    {
      id: 'variant-128gb',
      name: '128GB',
      price: 552000,
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
      variant_attributes: {
        storage: ['128GB', '256GB'],
      },
      variants: validProductRow.variants,
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
      variants: validProductRow.variants,
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
