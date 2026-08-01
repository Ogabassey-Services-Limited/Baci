import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreBuildStatusCard } from './store-build-status-card';
import { createReadinessPayload } from './store-build-status-card.test-helpers';

const { mockFetchWithCsrf } = vi.hoisted(() => ({
  mockFetchWithCsrf: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('StoreBuildStatusCard in-flight merchant state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const requestUrl = new URL(String(input), 'https://usebaci.com');
      const merchantId = requestUrl.searchParams.get('merchantId');
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...createReadinessPayload(true),
          merchantId,
        }),
      } as Response);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('encodes the selected merchant in the readiness URL', async () => {
    render(<StoreBuildStatusCard merchantId="merchant/with a query?" />);

    expect(await screen.findByText('AI design ready')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/merchant/readiness?merchantId=merchant%2Fwith+a+query%3F',
      { credentials: 'include' }
    );
  });

  it('keeps each merchant apply disabled while its own request is pending', async () => {
    const merchantARequest = deferred<Response>();
    const merchantBRequest = deferred<Response>();
    mockFetchWithCsrf
      .mockReturnValueOnce(merchantARequest.promise)
      .mockReturnValueOnce(merchantBRequest.promise);
    const { rerender } = render(
      <StoreBuildStatusCard merchantId="merchant-a" />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );
    rerender(<StoreBuildStatusCard merchantId="merchant-b" />);
    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );
    rerender(<StoreBuildStatusCard merchantId="merchant-a" />);

    expect(
      await screen.findByRole('button', { name: /apply ai design/i })
    ).toBeDisabled();

    await act(async () => {
      merchantBRequest.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);
      merchantARequest.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);
      await Promise.all([merchantARequest.promise, merchantBRequest.promise]);
    });
  });
});
