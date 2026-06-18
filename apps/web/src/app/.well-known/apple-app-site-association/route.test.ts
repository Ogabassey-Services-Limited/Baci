import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET } from './route';

function makeRequest(host: string): NextRequest {
  const req = new NextRequest(
    `https://${host}/.well-known/apple-app-site-association`
  );
  req.headers.set('host', host);
  return req;
}

describe('GET /.well-known/apple-app-site-association', () => {
  it('returns 200 with application/json content type', () => {
    const res = GET(makeRequest('ogabassey.com'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns cache-control header', () => {
    const res = GET(makeRequest('ogabassey.com'));

    expect(res.headers.get('cache-control')).toContain('max-age=86400');
  });

  it('returns applinks in response body', async () => {
    const res = GET(makeRequest('ogabassey.com'));
    const body = await res.json();

    expect(body).toHaveProperty('applinks');
    expect(body.applinks).toHaveProperty('details');
  });

  it('does not redirect (status is not 3xx)', () => {
    const res = GET(makeRequest('ogabassey.com'));

    expect(res.status).toBeLessThan(300);
  });

  it('returns storefront details for ogabassey domain', async () => {
    const res = GET(makeRequest('ogabassey.com'));
    const body = await res.json();

    expect(body.applinks.details).toHaveLength(1);
    expect(body.applinks.details[0].appIDs[0]).toContain('com.ogabassey.store');
  });

  it('uses modern components format, not legacy paths', async () => {
    const res = GET(makeRequest('ogabassey.com'));
    const body = await res.json();

    const detail = body.applinks.details[0];
    expect(detail).toHaveProperty('components');
    expect(detail).not.toHaveProperty('paths');
  });

  it('advertises receipt claim universal links for the storefront app', async () => {
    const res = GET(makeRequest('ogabassey.com'));
    const body = await res.json();

    expect(body.applinks.details[0].components).toContainEqual({
      '/': '/receipts/claim/*',
    });
  });

  it('returns empty details for unknown merchant domain', async () => {
    const res = GET(makeRequest('somemerchant.com'));
    const body = await res.json();

    expect(body.applinks.details).toEqual([]);
  });

  it('returns admin details for platform root domain', async () => {
    const res = GET(makeRequest('usebaci.com'));
    const body = await res.json();

    expect(body.applinks.details).toHaveLength(1);
    expect(body.applinks.details[0].appIDs[0]).toContain('com.ogabassey.baci');
  });
});
