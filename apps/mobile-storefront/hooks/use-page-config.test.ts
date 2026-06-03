import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import type { PageConfig } from '@/lib/validation/page-config-schema';
import { usePageConfig } from './use-page-config';

const mockFrom = jest.fn<(table: string) => unknown>();
const mockUseMerchant = useMerchant as jest.MockedFunction<typeof useMerchant>;

jest.mock('@/hooks/product-utils', () => ({
  CONSTANT_MERCHANT_ID: 'fallback-merchant',
  log: {
    warn: jest.fn(),
  },
}));

jest.mock('@/hooks/use-merchant', () => ({
  useMerchant: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (queryFn: () => unknown) => queryFn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function createPageConfig(title: string): PageConfig {
  return {
    content: [],
    root: {
      props: {
        title,
      },
    },
  };
}

describe('usePageConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMerchant.mockReturnValue({
      data: { id: 'merchant-1' },
    } as ReturnType<typeof useMerchant>);
  });

  it('keeps cached home page config fresh across quick tab returns', () => {
    const queryClient = createQueryClient();
    const cachedConfig = createPageConfig('Cached Home');
    queryClient.setQueryData(
      ['page_config', 'home', 'merchant-1'],
      cachedConfig,
      { updatedAt: Date.now() - 10 * 60_000 }
    );

    const { result } = renderHook(() => usePageConfig('home'), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toEqual(cachedConfig);
    expect(mockFrom).not.toHaveBeenCalled();

    queryClient.clear();
  });
});
