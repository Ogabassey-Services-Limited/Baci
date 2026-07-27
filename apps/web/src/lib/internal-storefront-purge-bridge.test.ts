import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  error: vi.fn(),
  getAppUrl: vi.fn(),
  getInternalApiSecret: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/env', () => ({
  getAppUrl: mocks.getAppUrl,
  getInternalApiSecret: mocks.getInternalApiSecret,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.error } }));

import { scheduleInternalStorefrontPurge } from './internal-storefront-purge-bridge';

describe('scheduleInternalStorefrontPurge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUrl.mockReturnValue('https://app.usebaci.com');
    mocks.getInternalApiSecret.mockReturnValue('internal-secret');
    mocks.after.mockImplementation((callback: () => void) => callback());
  });

  it('uses the authenticated internal revalidation bridge for a scoped whole-storefront purge', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    scheduleInternalStorefrontPurge('merchant-1', 'ogabassey', { fetchImpl });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://app.usebaci.com/api/internal/revalidate-products'
    );
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer internal-secret',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      purgeWholeStorefront: true,
    });
  });

  it('keeps the internal request promise alive for the post-response lifetime', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    let afterCallbackResult: unknown;
    mocks.after.mockImplementationOnce((callback: () => unknown) => {
      afterCallbackResult = callback();
    });

    scheduleInternalStorefrontPurge('merchant-1', 'ogabassey', { fetchImpl });

    expect(afterCallbackResult).toBeInstanceOf(Promise);
    await expect(afterCallbackResult).resolves.toBeUndefined();
  });

  it('does not schedule an unidentified storefront purge', () => {
    const fetchImpl = vi.fn();

    scheduleInternalStorefrontPurge('merchant-1', null, { fetchImpl });

    expect(mocks.after).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps a failed internal bridge from changing the committed mutation result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    expect(() =>
      scheduleInternalStorefrontPurge('merchant-1', 'ogabassey', { fetchImpl })
    ).not.toThrow();

    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
  });
});
