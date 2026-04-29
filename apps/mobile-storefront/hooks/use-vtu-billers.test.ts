import { jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { fetchWithRetry } from '@/lib/api';
import { useVTUBillers, vtuBillerKeys } from './use-vtu-billers';

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

function expectKudaElectricityBillItems(
  data: ReturnType<typeof useVTUBillers>['data']
) {
  expect(data).toBeDefined();
  if (!data) {
    throw new Error('Expected biller data');
  }
  expect(data).toHaveLength(1);
  const billItems = data[0].billItems;
  expect(billItems).toBeDefined();
  if (!billItems) {
    throw new Error('Expected Kuda bill items');
  }
  expect(billItems).toHaveLength(2);
  expect(billItems[0].itemCode).toBe('KUD-ELE-EKED-002');
  expect(billItems[0].itemName).toBe('EKEDC PREPAID');
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
          billers: [
            {
              billerId: 'a3cacf1f-c1d6-410f-b11d-4dc9d7ea5dd0',
              billerName: 'EKEDC NG',
              billerType: 'Electricity',
              categoryId: '8593f820-5854-491f-b24b-fa371a99a907',
              categoryName: 'Electricity',
            },
          ],
        }),
    } as Awaited<ReturnType<typeof fetchWithRetry>>);
    const { result, unmount } = renderHook(() => useVTUBillers('electricity'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expectKudaElectricityBillItems(result.current.data);
    });
  });

  it('adds Kuda electricity bill item codes to cached providers', async () => {
    queryClient.setQueryData(vtuBillerKeys.byType('electricity'), [
      {
        billerId: 'a3cacf1f-c1d6-410f-b11d-4dc9d7ea5dd0',
        billerName: 'EKEDC NG',
        billerType: 'Electricity',
        categoryId: '8593f820-5854-491f-b24b-fa371a99a907',
        categoryName: 'Electricity',
      },
    ]);

    const { result, unmount } = renderHook(() => useVTUBillers('electricity'), {
      wrapper: createWrapper(queryClient),
    });
    unmountHook = unmount;

    await waitFor(() => {
      expectKudaElectricityBillItems(result.current.data);
    });
    expect(mockFetchWithRetry).not.toHaveBeenCalled();
  });
});
