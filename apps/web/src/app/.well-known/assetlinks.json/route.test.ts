import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET } from './route';

function makeRequest(host: string): NextRequest {
  const req = new NextRequest(`https://${host}/.well-known/assetlinks.json`);
  req.headers.set('host', host);
  return req;
}

describe('GET /.well-known/assetlinks.json', () => {
  it('returns 200 with application/json content type', () => {
    const res = GET(makeRequest('ogabassey.com'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns cache-control header', () => {
    const res = GET(makeRequest('ogabassey.com'));

    expect(res.headers.get('cache-control')).toContain('max-age=86400');
  });

  it('returns valid JSON array', async () => {
    const res = GET(makeRequest('ogabassey.com'));
    const body = await res.json();

    expect(Array.isArray(body)).toBe(true);
  });

  it('does not redirect (status is not 3xx)', () => {
    const res = GET(makeRequest('ogabassey.com'));

    expect(res.status).toBeLessThan(300);
  });

  it('returns storefront app for ogabassey domain', async () => {
    const res = GET(makeRequest('ogabassey.com'));
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].target.package_name).toBe('com.ogabassey.store');
    expect(body[0].relation).toContain(
      'delegate_permission/common.get_login_creds'
    );
  });

  it('returns storefront app for ogabassey subdomain on the root domain', async () => {
    const res = GET(makeRequest('ogabassey.usebaci.com'));
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].target.package_name).toBe('com.ogabassey.store');
    expect(body[0].relation).toContain(
      'delegate_permission/common.get_login_creds'
    );
  });

  it('advertises receipt claim app links for the storefront app', async () => {
    const res = GET(makeRequest('ogabassey.com'));
    const body = await res.json();

    const components =
      body[0].relation_extensions['delegate_permission/common.handle_all_urls']
        .dynamic_app_link_components;

    expect(components).toContainEqual({ '/': '/receipts/claim/*' });
  });

  it('returns empty array for unknown merchant domain', async () => {
    const res = GET(makeRequest('somemerchant.com'));
    const body = await res.json();

    expect(body).toEqual([]);
  });

  it('returns admin app for platform root domain', async () => {
    const res = GET(makeRequest('usebaci.com'));
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].target.package_name).toBe('com.ogabassey.baci');
    expect(body[0].relation).toContain(
      'delegate_permission/common.get_login_creds'
    );
  });
});
