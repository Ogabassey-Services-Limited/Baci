import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { AD_TRACKING_COOKIES } from '@/lib/ad-tracking-cookies';
import { GET } from './route';

const ORIGIN = 'https://ogabassey.com/api/attr';

// 90 days, matching ad-tracking-cookies.ts COOKIE_MAX_AGE (90 * 24 * 60 * 60).
const NINETY_DAYS_SECONDS = 7_776_000;

function requestFor(query: string): NextRequest {
  return new NextRequest(`${ORIGIN}${query}`);
}

describe('GET /api/attr', () => {
  it('returns 204 with no body and no-store on a valid single click ID', () => {
    const response = GET(requestFor('?gclid=Cj0KCQjw_abc-123'));

    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('sets the exact baci_gclid cookie contract', () => {
    const response = GET(requestFor('?gclid=abc123'));
    const setCookies = response.headers.getSetCookie();

    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]).toBe(
      `${AD_TRACKING_COOKIES.GOOGLE_CLICK_ID}=abc123; Path=/; Max-Age=${NINETY_DAYS_SECONDS}; SameSite=Lax; Secure`
    );
  });

  it('sets one cookie per click ID when several are present', () => {
    const response = GET(
      requestFor('?fbclid=fb1&ttclid=tt1&gclid=g1&sccid=sc1')
    );
    const setCookies = response.headers.getSetCookie();

    expect(setCookies).toHaveLength(4);
    const names = setCookies.map((c) => c.split('=')[0]);
    expect(names.sort()).toEqual(
      [
        AD_TRACKING_COOKIES.FACEBOOK_CLICK_ID,
        AD_TRACKING_COOKIES.TIKTOK_CLICK_ID,
        AD_TRACKING_COOKIES.GOOGLE_CLICK_ID,
        AD_TRACKING_COOKIES.SNAPCHAT_CLICK_ID,
      ].sort()
    );
  });

  it('URL-encodes the cookie value', () => {
    // A tilde is URL-safe per the schema but encodeURIComponent leaves it as-is;
    // assert a dot/underscore/hyphen token round-trips unescaped.
    const response = GET(requestFor('?gclid=a.b_c-d~e'));
    const setCookies = response.headers.getSetCookie();

    expect(setCookies[0]).toContain(
      `${AD_TRACKING_COOKIES.GOOGLE_CLICK_ID}=a.b_c-d~e;`
    );
  });

  it('returns 400 + no-store and sets no cookie for unknown params', () => {
    const response = GET(requestFor('?utm_source=google'));

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('returns 400 when a known click ID rides alongside an unknown param', () => {
    // The inline script filters to known params before calling, so a mixed
    // query reaching the endpoint is tampering — reject it, do not set cookies.
    const response = GET(requestFor('?gclid=abc&utm_source=google'));

    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('returns 400 with no click IDs present', () => {
    const response = GET(requestFor(''));

    expect(response.status).toBe(400);
  });

  it('returns 400 for an over-length value', () => {
    const response = GET(requestFor(`?gclid=${'a'.repeat(257)}`));

    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('returns 400 for a value with unsupported characters', () => {
    const response = GET(requestFor('?gclid=has%20space'));

    expect(response.status).toBe(400);
  });
});
