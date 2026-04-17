import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useJumiaIntegrations } from './use-jumia-integrations';

type HookToast = Parameters<typeof useJumiaIntegrations>[1];

interface HookProbeProps {
  merchantId?: string;
  toast: HookToast;
}

function HookProbe({ merchantId = 'merchant-1', toast }: HookProbeProps) {
  const { jumiaIntegrations, jumiaIntegrationId, jumiaLoading } =
    useJumiaIntegrations(merchantId, toast);

  return (
    <div>
      <p>{`loading:${jumiaLoading ? 'true' : 'false'}`}</p>
      <p>{`selected:${jumiaIntegrationId ?? 'none'}`}</p>
      <ul aria-label="Jumia shops">
        {jumiaIntegrations.map((integration) => (
          <li key={integration.id}>{integration.shop_name}</li>
        ))}
      </ul>
    </div>
  );
}

describe('useJumiaIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {
      return undefined;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads integrations and auto-selects the only available shop', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          integrations: [{ id: 'integration-1', shop_name: 'Main Shop' }],
        }),
    } as Response);

    const toast = vi.fn<HookToast>();
    render(<HookProbe toast={toast} />);

    await waitFor(() => {
      expect(screen.getByText('loading:false')).toBeInTheDocument();
    });

    expect(screen.getByText('selected:integration-1')).toBeInTheDocument();
    expect(screen.getByText('Main Shop')).toBeInTheDocument();
  });

  it('shows a destructive toast when the request fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    } as Response);

    const toast = vi.fn<HookToast>();
    render(<HookProbe toast={toast} />);

    await waitFor(() => {
      expect(screen.getByText('loading:false')).toBeInTheDocument();
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Jumia Integration',
        variant: 'destructive',
      })
    );
  });

  it('aborts an in-flight request on unmount', () => {
    const abort = vi.fn();
    const mockSignal = { aborted: false };

    class MockAbortController {
      signal = mockSignal as AbortSignal;

      abort() {
        mockSignal.aborted = true;
        abort();
      }
    }

    vi.stubGlobal(
      'AbortController',
      MockAbortController as unknown as typeof AbortController
    );
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));

    const { unmount } = render(<HookProbe toast={vi.fn<HookToast>()} />);

    expect(mockSignal.aborted).toBe(false);

    unmount();

    expect(mockSignal.aborted).toBe(true);
    expect(abort).toHaveBeenCalledTimes(1);
  });
});
