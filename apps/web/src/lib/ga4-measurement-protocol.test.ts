import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendGA4Event } from './ga4-measurement-protocol';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendGA4Event', () => {
  it('passes the caller abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await sendGA4Event(
      'G-TEST',
      'secret',
      'page_view',
      { clientId: 'client-1' },
      {},
      false,
      controller.signal
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('returns an HTTP failure without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    const result = await sendGA4Event('G-TEST', 'secret', 'page_view', {
      clientId: 'client-1',
    });

    expect(result).toEqual({ error: 'HTTP 503', success: false });
  });

  it('puts a durable event timestamp in the GA4 event parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await sendGA4Event(
      'G-TEST',
      'secret',
      'purchase',
      { clientId: 'client-1' },
      {},
      false,
      undefined,
      1_783_857_600_000_000
    );

    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(payload.events[0]).not.toHaveProperty('timestamp_micros');
    expect(payload.events[0].params.timestamp_micros).toBe(
      1_783_857_600_000_000
    );
  });

  it('serializes an IP override as GA4 request metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await sendGA4Event('G-TEST', 'secret', 'page_view', {
      clientId: 'client-1',
      ipAddress: '203.0.113.1',
    });

    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(payload.ip_override).toBe('203.0.113.1');
    expect(payload).not.toHaveProperty('user_properties');
  });
});
