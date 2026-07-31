import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useStorePublish } from './useStorePublish';

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
  NetworkError: class NetworkError extends Error {},
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }

  return Wrapper;
}

describe('useStorePublish merchant switching', () => {
  it('does not complete a merchant A publish in merchant B UI', async () => {
    let resolvePublish!: () => void;
    const publishRequest = new Promise<void>((resolve) => {
      resolvePublish = resolve;
    });
    const onPublished = vi.fn().mockResolvedValue(undefined);
    mockApiClient.mockReturnValueOnce(publishRequest);

    const { result, rerender } = renderHook(
      ({ merchantId }) => useStorePublish({ merchantId, onPublished }),
      {
        initialProps: { merchantId: 'merchant-a' },
        wrapper: createWrapper(),
      }
    );

    let publish!: ReturnType<typeof result.current.publishStore>;
    act(() => {
      publish = result.current.publishStore();
    });
    await waitFor(() => expect(result.current.isPublishing).toBe(true));

    rerender({ merchantId: 'merchant-b' });
    expect(result.current.isPublishing).toBe(false);

    let publishResult:
      | Awaited<ReturnType<typeof result.current.publishStore>>
      | undefined;
    await act(async () => {
      resolvePublish();
      publishResult = await publish;
    });

    expect(publishResult).toEqual({ status: 'stale' });
    expect(onPublished).not.toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });
});
