import { describe, expect, it, vi } from 'vitest';
import {
  buildIndexNowBlogPostUrl,
  buildIndexNowPayload,
  getIndexNowHostFromIdentifiers,
  submitIndexNowUrls,
} from './indexnow';

const INDEXNOW_TEST_KEY = '0751d5c882ab3d7c013ecbfe9e624d71';

describe('IndexNow helpers', () => {
  it('builds a host-scoped payload and filters non-matching URLs', () => {
    expect(
      buildIndexNowPayload({
        host: 'ogabassey.com',
        urls: [
          'https://ogabassey.com/blog/infinix-hot-70',
          'https://www.ogabassey.com/blog/redmi-a7-pro',
          'https://other.example/blog/not-owned',
          'not-a-url',
        ],
      })
    ).toEqual({
      host: 'ogabassey.com',
      key: INDEXNOW_TEST_KEY,
      keyLocation: `https://ogabassey.com/${INDEXNOW_TEST_KEY}.txt`,
      urlList: [
        'https://ogabassey.com/blog/infinix-hot-70',
        'https://www.ogabassey.com/blog/redmi-a7-pro',
      ],
    });
  });

  it('derives a custom-domain host from cache identifiers and builds blog URLs safely', () => {
    expect(
      getIndexNowHostFromIdentifiers(['test-store', 'www.ogabassey.com'])
    ).toBe('www.ogabassey.com');
    expect(buildIndexNowBlogPostUrl('www.ogabassey.com', 'redmi a7 pro')).toBe(
      'https://ogabassey.com/blog/redmi%20a7%20pro'
    );
    expect(buildIndexNowBlogPostUrl('ogabassey.com', '')).toBeNull();
    expect(getIndexNowHostFromIdentifiers(['test-store'])).toBeNull();
  });

  it('submits the payload to the configured IndexNow endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: vi.fn().mockResolvedValue(''),
    });

    const result = await submitIndexNowUrls({
      fetchImpl: fetchMock,
      host: 'ogabassey.com',
      urls: ['https://ogabassey.com/blog/infinix-hot-70'],
    });

    expect(result).toEqual({
      status: 'submitted',
      submitted: 1,
      endpoint: 'https://api.indexnow.org/indexnow',
      responseStatus: 202,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.indexnow.org/indexnow',
      expect.objectContaining({
        body: JSON.stringify({
          host: 'ogabassey.com',
          key: INDEXNOW_TEST_KEY,
          keyLocation: `https://ogabassey.com/${INDEXNOW_TEST_KEY}.txt`,
          urlList: ['https://ogabassey.com/blog/infinix-hot-70'],
        }),
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        method: 'POST',
      })
    );
  });

  it('honors explicit IndexNow key and endpoint overrides', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(''),
    });

    const result = await submitIndexNowUrls({
      endpoint: 'https://indexnow.example/submit',
      fetchImpl: fetchMock,
      host: 'ogabassey.com',
      key: 'merchant-key',
      urls: ['https://ogabassey.com/blog/infinix-hot-70'],
    });

    expect(result).toMatchObject({
      endpoint: 'https://indexnow.example/submit',
      status: 'submitted',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://indexnow.example/submit',
      expect.objectContaining({
        body: expect.stringContaining('merchant-key'),
      })
    );
  });

  it('skips submission when the IndexNow key is missing', async () => {
    const fetchMock = vi.fn();

    await expect(
      submitIndexNowUrls({
        fetchImpl: fetchMock,
        host: 'ogabassey.com',
        key: '',
        urls: ['https://ogabassey.com/blog/infinix-hot-70'],
      })
    ).resolves.toEqual({
      reason: 'missing_key',
      status: 'skipped',
      submitted: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips submission when there are no valid host-owned URLs', async () => {
    const fetchMock = vi.fn();

    await expect(
      submitIndexNowUrls({
        fetchImpl: fetchMock,
        host: 'ogabassey.com',
        urls: ['https://other.example/blog/not-owned'],
      })
    ).resolves.toEqual({
      reason: 'no_valid_urls',
      status: 'skipped',
      submitted: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a failed result when the IndexNow request rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network timeout'));

    await expect(
      submitIndexNowUrls({
        fetchImpl: fetchMock,
        host: 'ogabassey.com',
        urls: ['https://ogabassey.com/blog/infinix-hot-70'],
      })
    ).resolves.toEqual({
      endpoint: 'https://api.indexnow.org/indexnow',
      responseBody: 'Network timeout',
      responseStatus: 0,
      status: 'failed',
      submitted: 1,
    });
  });

  it('returns a failed result when a non-2xx response body cannot be read', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('Body unavailable')),
    });

    await expect(
      submitIndexNowUrls({
        fetchImpl: fetchMock,
        host: 'ogabassey.com',
        urls: ['https://ogabassey.com/blog/infinix-hot-70'],
      })
    ).resolves.toEqual({
      endpoint: 'https://api.indexnow.org/indexnow',
      responseBody: 'Body unavailable',
      responseStatus: 500,
      status: 'failed',
      submitted: 1,
    });
  });

  it('returns a failed result for non-2xx IndexNow responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue('invalid payload'),
    });

    await expect(
      submitIndexNowUrls({
        fetchImpl: fetchMock,
        host: 'ogabassey.com',
        urls: ['https://ogabassey.com/blog/infinix-hot-70'],
      })
    ).resolves.toEqual({
      endpoint: 'https://api.indexnow.org/indexnow',
      responseBody: 'invalid payload',
      responseStatus: 422,
      status: 'failed',
      submitted: 1,
    });
  });
});
