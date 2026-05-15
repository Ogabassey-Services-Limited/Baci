import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyImeiChecker } from './imei-checker';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt ?? '')} />
  ),
}));

describe('OgabasseyImeiChecker', () => {
  beforeEach(() => {
    document.cookie = 'csrf-token=test-csrf-token; path=/';
    fetchMock.mockReset();
  });

  const getFetchHeaders = (callIndex: number) => {
    const init = fetchMock.mock.calls[callIndex]?.[1] as
      | { headers?: HeadersInit }
      | undefined;

    return new Headers(init?.headers);
  };

  const enterValidImei = () => {
    fireEvent.change(screen.getByPlaceholderText(/enter 15-digit imei/i), {
      target: { value: '354442067957452' },
    });
  };

  const successfulImeiResponse = {
    success: true,
    data: {
      imei: '354442067957452',
      device: 'iPhone 15 Pro',
      modelNumber: 'A3101',
      status: 'Clean',
      icloud: 'Off',
      icloudLock: 'Off',
      simLock: 'Unlocked',
      blacklistStatus: 'Clean',
      carrier: 'Unlocked',
      deviceImage: '',
      score: 98,
      deviceType: 'apple',
      verdict: 'Safe to buy',
      verdictType: 'safe',
    },
  };

  it('renders the public IMEI tiers accepted by the API', () => {
    render(<OgabasseyImeiChecker />);

    expect(
      screen.getByRole('button', {
        name: /full report, know everything, ₦1,500/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /activation check, is it actually brand new\?, ₦700/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /stolen check, is it reported stolen\?, ₦700/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /network check, will my sim work\?, ₦1,000/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('Quick ID')).not.toBeInTheDocument();
    expect(screen.queryByText('iCloud Check')).not.toBeInTheDocument();
  });

  it('posts IMEI checks with an idempotency key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(successfulImeiResponse),
    });

    render(<OgabasseyImeiChecker />);

    enterValidImei();
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { body: string; method: string },
    ];
    const headers = getFetchHeaders(0);

    expect(url).toBe('/api/storefront/imei-check');
    expect(init.method).toBe('POST');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('test-csrf-token');
    expect(headers.get('idempotency-key')).toEqual(
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    );
    expect(JSON.parse(init.body)).toMatchObject({
      imei: '354442067957452',
      tier: 'full',
    });
    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument();
    expect(screen.getByText('Safe to buy')).toBeInTheDocument();
  });

  it.each([
    [
      'activation',
      /activation check, is it actually brand new\?, ₦700/i,
      'activation',
    ],
    ['blacklist', /stolen check, is it reported stolen\?, ₦700/i, 'blacklist'],
    ['carrier', /network check, will my sim work\?, ₦1,000/i, 'carrier'],
  ])('posts the selected %s tier', async (_label, tierButtonName, expectedTier) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(successfulImeiResponse),
    });

    render(<OgabasseyImeiChecker />);

    fireEvent.click(screen.getByRole('button', { name: tierButtonName }));
    enterValidImei();
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { body: string; method: string },
    ];

    expect(JSON.parse(init.body)).toMatchObject({
      imei: '354442067957452',
      tier: expectedTier,
    });
  });

  it('reuses the idempotency key when retrying the same IMEI and tier', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(successfulImeiResponse),
      });

    render(<OgabasseyImeiChecker />);

    enterValidImei();
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    expect(
      await screen.findByText(
        'Network error. Please check your connection and try again.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstHeaders = getFetchHeaders(0);
    const secondHeaders = getFetchHeaders(1);

    expect(secondHeaders.get('idempotency-key')).toBe(
      firstHeaders.get('idempotency-key')
    );
    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  it('creates a fresh idempotency key after a terminal API response', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          code: 'WALLET_INSUFFICIENT',
          error: 'Wallet balance is too low.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(successfulImeiResponse),
      });

    render(<OgabasseyImeiChecker />);

    enterValidImei();
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    expect(
      await screen.findByText('Wallet balance is too low.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstHeaders = getFetchHeaders(0);
    const secondHeaders = getFetchHeaders(1);

    expect(secondHeaders.get('idempotency-key')).not.toBe(
      firstHeaders.get('idempotency-key')
    );
    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  it('preserves the idempotency key while a refund is pending', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          code: 'REFUND_PENDING',
          error: 'Refund is being processed.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(successfulImeiResponse),
      });

    render(<OgabasseyImeiChecker />);

    enterValidImei();
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    expect(
      await screen.findByText('Refund is being processed.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstHeaders = getFetchHeaders(0);
    const secondHeaders = getFetchHeaders(1);

    expect(secondHeaders.get('idempotency-key')).toBe(
      firstHeaders.get('idempotency-key')
    );
    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  it('shows the API error message when an IMEI check fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: 'Wallet balance is too low.',
      }),
    });

    render(<OgabasseyImeiChecker />);

    enterValidImei();
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    expect(
      await screen.findByText('Wallet balance is too low.')
    ).toBeInTheDocument();
  });

  it('shows a network error when the IMEI request rejects', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    render(<OgabasseyImeiChecker />);

    enterValidImei();
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }));

    expect(
      await screen.findByText(
        'Network error. Please check your connection and try again.'
      )
    ).toBeInTheDocument();
  });

  it('keeps invalid IMEI submissions disabled', () => {
    render(<OgabasseyImeiChecker />);

    const submitButton = screen.getByRole('button', { name: /verify now/i });

    fireEvent.change(screen.getByPlaceholderText(/enter 15-digit imei/i), {
      target: { value: '35444206795745' },
    });

    expect(submitButton).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables the submit button while an IMEI check is in flight', async () => {
    let resolveRequest: (
      response: { ok: true; json: () => Promise<typeof successfulImeiResponse> }
    ) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<OgabasseyImeiChecker />);

    enterValidImei();
    const submitButton = screen.getByRole('button', { name: /verify now/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());

    resolveRequest({
      ok: true,
      json: vi.fn().mockResolvedValue(successfulImeiResponse),
    });

    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument();
  });
});
