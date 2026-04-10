import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import { fetchAvailableBrands } from '@/hooks/product-utils';
import { useProductBrands } from '@/hooks/use-products';

jest.mock('@/hooks/use-merchant', () => ({
  useMerchant: jest.fn(),
}));

jest.mock('@/hooks/product-utils', () => ({
  CONSTANT_MERCHANT_ID: 'merchant-fallback',
  fetchAvailableBrands: jest.fn(),
  fetchProductsPage: jest.fn(),
}));

const mockUseMerchant = useMerchant as jest.MockedFunction<typeof useMerchant>;
const mockFetchAvailableBrands = fetchAvailableBrands as jest.MockedFunction<
  typeof fetchAvailableBrands
>;

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

describe('useProductBrands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMerchant.mockReturnValue({
      data: { id: 'merchant-1' },
    } as ReturnType<typeof useMerchant>);
  });

  it('fetches brand options with the current merchant id', async () => {
    mockFetchAvailableBrands.mockResolvedValue(['Infinix', 'Samsung']);
    const queryClient = createQueryClient();

    const { result } = renderHook(
      () =>
        useProductBrands({
          category: 'phones',
          condition: 'Open Box',
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(result.current.brands).toEqual(['Infinix', 'Samsung']);
    });

    expect(mockFetchAvailableBrands).toHaveBeenCalledWith('merchant-1', {
      category: 'phones',
      condition: 'Open Box',
    });
  });
});
