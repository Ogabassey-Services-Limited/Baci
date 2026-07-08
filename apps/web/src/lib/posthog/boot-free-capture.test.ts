import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPostHogCaptureUrl,
  isLikelyBotUserAgent,
  redactUrlQuery,
  sendBootFreeCaptureEvent,
} from '@/lib/posthog/boot-free-capture';

describe('redactUrlQuery', () => {
  it('strips query strings and hashes', () => {
    expect(redactUrlQuery('https://a.com/p?gclid=x&y=1')).toBe(
      'https://a.com/p'
    );
    expect(redactUrlQuery('https://a.com/p#frag')).toBe('https://a.com/p');
  });

  it('returns clean URLs unchanged', () => {
    expect(redactUrlQuery('https://a.com/p')).toBe('https://a.com/p');
  });
});

describe('isLikelyBotUserAgent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flags crawler user agents', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    });
    expect(isLikelyBotUserAgent()).toBe(true);
  });

  it('passes ordinary browsers', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 13) Chrome/126.0 Mobile',
    });
    expect(isLikelyBotUserAgent()).toBe(false);
  });
});

describe('buildPostHogCaptureUrl', () => {
  it('joins the relay proxy path with the capture endpoint', () => {
    expect(
      buildPostHogCaptureUrl({ NEXT_PUBLIC_POSTHOG_PROXY_PATH: '/baci-relay' })
    ).toBe('/baci-relay/i/v0/e/');
  });
});

describe('sendBootFreeCaptureEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delivers via sendBeacon with a JSON blob', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon });

    const delivered = sendBootFreeCaptureEvent('/u', '{"a":1}');

    expect(delivered).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    expect(blob.type).toBe('application/json');
  });

  it('falls back to keepalive fetch when sendBeacon declines', () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('fetch', fetchMock);

    const delivered = sendBootFreeCaptureEvent('/u', '{"a":1}');

    expect(delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/u',
      expect.objectContaining({ keepalive: true, method: 'POST' })
    );
  });

  it('returns false when no transport is available', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('fetch', undefined);

    expect(sendBootFreeCaptureEvent('/u', '{}')).toBe(false);
  });
});
