import { act, renderHook, waitFor } from '@testing-library/react';
import { Suspense, startTransition, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestMerchantPublish } from '@/lib/merchant-publish-client';
import { useDashboardPublishToggle } from './use-dashboard-publish-toggle';

vi.mock('@/lib/merchant-publish-client', () => ({
  requestMerchantPublish: vi.fn(),
}));

const { mockRefresh, mockReloadMerchant, mockToast } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockReloadMerchant: vi.fn(),
  mockToast: vi.fn(),
}));

function renderPublishToggle(merchantId = 'merchant-1', isPublished = true) {
  return renderHook(
    ({ currentMerchantId, currentIsPublished }) =>
      useDashboardPublishToggle({
        isPublished: currentIsPublished,
        merchantId: currentMerchantId,
        refresh: mockRefresh,
        reloadMerchant: mockReloadMerchant,
        toast: mockToast,
      }),
    {
      initialProps: {
        currentIsPublished: isPublished,
        currentMerchantId: merchantId,
      },
    }
  );
}

describe('useDashboardPublishToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the current merchant publish state and clears that merchant pending state', async () => {
    vi.mocked(requestMerchantPublish).mockResolvedValue(new Response('{}'));
    const { result } = renderPublishToggle();

    await act(async () => {
      await result.current.togglePublish();
    });

    expect(requestMerchantPublish).toHaveBeenCalledWith('merchant-1', true);
    expect(result.current.isPublishing).toBe(false);
    expect(mockReloadMerchant).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('does not apply a previous merchant completion after the selected merchant changes', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.mocked(requestMerchantPublish).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      })
    );
    const { result, rerender } = renderPublishToggle();

    act(() => {
      void result.current.togglePublish();
    });
    rerender({ currentIsPublished: false, currentMerchantId: 'merchant-2' });

    await act(async () => {
      resolveRequest?.(new Response('{}'));
    });

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockReloadMerchant).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('retains the first merchant pending state while another merchant publish is in flight', async () => {
    const resolveRequests = new Map<string, (response: Response) => void>();
    vi.mocked(requestMerchantPublish).mockImplementation(
      (merchantId) =>
        new Promise<Response>((resolve) => {
          resolveRequests.set(merchantId, resolve);
        })
    );
    const { result, rerender } = renderPublishToggle();

    act(() => {
      void result.current.togglePublish();
    });
    rerender({ currentIsPublished: false, currentMerchantId: 'merchant-2' });
    act(() => {
      void result.current.togglePublish();
    });
    rerender({ currentIsPublished: true, currentMerchantId: 'merchant-1' });

    await waitFor(() => {
      expect(result.current.isPublishing).toBe(true);
    });
  });

  it('accepts merchant A completion after a merchant B render is abandoned', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.mocked(requestMerchantPublish).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      })
    );
    let committedToggle: (() => Promise<void>) | undefined;
    const never = new Promise<void>(() => undefined);

    function Harness({ merchantId }: { merchantId: string }) {
      const actions = useDashboardPublishToggle({
        isPublished: false,
        merchantId,
        refresh: mockRefresh,
        reloadMerchant: mockReloadMerchant,
        toast: mockToast,
      });
      useLayoutEffect(() => {
        committedToggle = actions.togglePublish;
      });
      return null;
    }

    function SuspendAbandonedRender({ suspend }: { suspend: boolean }) {
      if (suspend) throw never;
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Suspense fallback={null}>
          <Harness merchantId="merchant-a" />
          <SuspendAbandonedRender suspend={false} />
        </Suspense>
      );
    });

    let publish: Promise<void> | undefined;
    act(() => {
      publish = committedToggle?.();
    });
    await waitFor(() => expect(requestMerchantPublish).toHaveBeenCalledOnce());

    act(() => {
      startTransition(() => {
        root.render(
          <Suspense fallback={null}>
            <Harness merchantId="merchant-b" />
            <SuspendAbandonedRender suspend />
          </Suspense>
        );
      });
    });
    await act(async () => {
      resolveRequest?.(new Response('{}'));
      await publish;
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Store Published!' })
    );
    expect(mockRefresh).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});
