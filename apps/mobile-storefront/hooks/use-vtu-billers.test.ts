import { jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { fetchWithRetry } from '@/lib/api';
import { useVTUBillers, vtuBillerKeys } from '@/hooks/use-vtu-billers';

jest.mock('@/lib/api', () => ({
  fetchWithRetry: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<
  typeof fetchWithRetry
>;

let queryClient: QueryClient;
let unmountHook: (() => void) | undefined;

const mockEKEDCBiller = {
  billerId: 'a3cacf1f-c1d6-410f-b11d-4dc9d7ea5dd0',
  billerName: 'EKEDC NG',
  billerType: 'Electricity',
  categoryId: '8593f820-5854-491f-b24b-fa371a99a907',
  categoryName: 'Electricity',
};

function assertDefined<T>(
  value: T,
  message: string
): asserts value is NonNullable<T> {
  expect(value).toBeDefined();
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}

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

function expectEKEDCKudaAugmentedBillItems(
  data: ReturnType<typeof useVTUBillers>['data']
) {
  assertDefined(data, 'Expected biller data');
  expect(data).toHaveLength(1);
  const billItems = data[0].billItems;
  assertDefined(billItems, 'Expected Kuda bill items');
  expect(billItems).toEqual([
    expect.objectContaining({
      itemCode: 'KUD-ELE-EKED-002',
      itemName: 'EKEDC PREPAID',
    }),
    expect.objectContaining({
      itemCode: 'KUD-ELE-EKED-001',
      itemName: 'EKEDC POSTPAID',
    }),
  ]);
}

describe('useVTUBillers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createQueryClient();
    unmountHook = undefined;
  });

  afterEach(() => {
    unmountHook?.();
    queryClient.clear();
  });

  it('adds Kuda electricity bill item codes to providers without bill items', async () => {
    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          billers: [mockEKEDCBiller],
        }),
    } as Awaited<ReturnType<typeof fetchWithRetry>>);
    const { result, unmount } = renderHook(() => useVTUBillers('electricity'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expectEKEDCKudaAugmentedBillItems(result.current.data);
    });
  });

  it('adds Kuda electricity bill item codes to cached providers', async () => {
    queryClient.setQueryData(vtuBillerKeys.byType('electricity'), [
      mockEKEDCBiller,
    ]);

    const { result, unmount } = renderHook(() => useVTUBillers('electricity'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expectEKEDCKudaAugmentedBillItems(result.current.data);
    });
    expect(mockFetchWithRetry).not.toHaveBeenCalled();
  });

  it('keeps nested Kuda data packages available to the data purchase form', async () => {
    mockFetchWithRetry.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          billers: [
            {
              billerId: '2082751a-89c7-4862-86c5-5498194b32f3',
              billerName: 'MTN',
              billerType: 'Internet Data',
              categoryId: 'data',
              categoryName: 'Internet Data',
              billItems: [
                {
                  amount: 3500,
                  isAmountFixed: true,
                  itemCode: 'MTN-35GB-MONTHLY',
                  itemCurrencySymbol: 'NGN',
                  itemFee: 0,
                  itemName: 'MTN 3.5GB Monthly',
                },
              ],
            },
          ],
        }),
    } as Awaited<ReturnType<typeof fetchWithRetry>>);

    const { result, unmount } = renderHook(() => useVTUBillers('data'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expect(result.current.data?.[0]).toMatchObject({
        billerId: '2082751a-89c7-4862-86c5-5498194b32f3',
        billItems: [
          expect.objectContaining({
            itemCode: 'MTN-35GB-MONTHLY',
            amount: 3500,
          }),
        ],
      });
    });
  });

  it('returns an error state when fetchWithRetry rejects without cached billers', async () => {
    // Failed requests have no provider payload to preserve; cached query data is the only fallback path.
    const fetchError = new Error('Network unavailable');
    mockFetchWithRetry.mockRejectedValue(fetchError);

    const { result, unmount } = renderHook(() => useVTUBillers('electricity'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe(fetchError);
  });

  it('returns an HTTP error state when the biller response is not ok', async () => {
    mockFetchWithRetry.mockResolvedValue({
      ok: false,
      status: 503,
    } as Awaited<ReturnType<typeof fetchWithRetry>>);

    const { result, unmount } = renderHook(() => useVTUBillers('electricity'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error).toHaveProperty(
      'message',
      'Failed to fetch providers (HTTP 503)'
    );
  });

  it('keeps cached Kuda-augmented electricity billers when a refresh fails', async () => {
    queryClient.setQueryData(
      vtuBillerKeys.byType('electricity'),
      [mockEKEDCBiller],
      { updatedAt: 0 }
    );
    mockFetchWithRetry.mockRejectedValue(new Error('Network unavailable'));

    const { result, unmount } = renderHook(() => useVTUBillers('electricity'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expect(mockFetchWithRetry).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.isRefetchError).toBe(true);
    });
    expectEKEDCKudaAugmentedBillItems(result.current.data);
  });
});
