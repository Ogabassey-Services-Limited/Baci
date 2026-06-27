import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  capturePublicBlogPageview,
  resetPublicBlogPageviewDedupeForTests,
} from './public-blog-pageview';

afterEach(() => {
  resetPublicBlogPageviewDedupeForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('capturePublicBlogPageview', () => {
  it('sends a tiny direct PostHog pageview beacon through the configured relay', () => {
    const sendBeacon = vi.fn<typeof navigator.sendBeacon>(() => true);
    const storage = new Map<string, string>();

    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal('crypto', { randomUUID: () => 'visitor-1' });
    vi.stubGlobal('location', { origin: 'https://ogabassey.com' });

    capturePublicBlogPageview(
      {
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_public',
        NEXT_PUBLIC_POSTHOG_PROXY_PATH: '/baci-relay',
      },
      'https://ogabassey.com/blog?page=2#posts'
    );

    expect(sendBeacon).toHaveBeenCalledOnce();
    const firstCall = sendBeacon.mock.calls[0] as Parameters<
      typeof navigator.sendBeacon
    >;
    expect(firstCall[0]).toBe('/baci-relay/capture/');
    expect(firstCall[1]).toBeInstanceOf(Blob);
  });

  it('falls back to keepalive fetch when sendBeacon is unavailable', () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Promise.resolve(new Response(null))
    );

    vi.stubGlobal('navigator', {});
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('location', { origin: 'https://ogabassey.com' });
    vi.stubGlobal('localStorage', {
      getItem: () => 'visitor-1',
      setItem: vi.fn(),
    });

    capturePublicBlogPageview(
      {
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_public',
      },
      'https://ogabassey.com/blog/post?email=buyer@example.com'
    );

    expect(fetch).toHaveBeenCalledWith('/baci-relay/capture/', {
      body: expect.stringContaining('public_blog_lightweight'),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      method: 'POST',
    });
    const firstFetchInit = fetch.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(firstFetchInit.body as string);
    expect(body).toMatchObject({
      api_key: 'ph_public',
      event: '$pageview',
      distinct_id: 'visitor-1',
      properties: {
        $current_url: 'https://ogabassey.com/blog/post',
        $host: 'ogabassey.com',
        $pathname: '/blog/post',
        distinct_id: 'visitor-1',
        token: 'ph_public',
      },
    });
  });

  it('does nothing without a public project token', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    capturePublicBlogPageview({}, 'https://ogabassey.com/blog');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps query-only navigations observable while redacting query values', () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Promise.resolve(new Response(null))
    );
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('location', { origin: 'https://ogabassey.com' });

    const env = { NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_public' };
    capturePublicBlogPageview(env, 'https://ogabassey.com/blog?page=1');
    capturePublicBlogPageview(env, 'https://ogabassey.com/blog?page=2');

    expect(fetch).toHaveBeenCalledTimes(2);
    const payloads = fetch.mock.calls.map((call) =>
      JSON.parse((call[1] as RequestInit).body as string)
    );
    expect(payloads).toEqual([
      expect.objectContaining({
        properties: expect.objectContaining({
          $current_url: 'https://ogabassey.com/blog',
        }),
      }),
      expect.objectContaining({
        properties: expect.objectContaining({
          $current_url: 'https://ogabassey.com/blog',
        }),
      }),
    ]);
  });

  it('deduplicates exact repeated blog pageviews', () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Promise.resolve(new Response(null))
    );
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('location', { origin: 'https://ogabassey.com' });

    const env = { NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_public' };
    capturePublicBlogPageview(env, 'https://ogabassey.com/blog');
    capturePublicBlogPageview(env, 'https://ogabassey.com/blog');

    expect(fetch).toHaveBeenCalledOnce();
  });
});
