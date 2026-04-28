import { describe, expect, it } from 'vitest';
import {
  buildRequestBaseUrl,
  getRequestHost,
  isLocalhostIdentifier,
  resolveStorefrontRouteIdentifier,
  stripPort,
} from './storefront-host';

describe('storefront host helpers', () => {
  it('normalizes the host header before request URL fallback', () => {
    const request = new Request(
      'https://fallback.example/agent-commerce.json',
      {
        headers: { host: 'https://Ogabassey.COM/path, proxy.example' },
      }
    );

    expect(getRequestHost(request)).toBe('ogabassey.com');
    expect(buildRequestBaseUrl(request)).toBe('https://ogabassey.com');
  });

  it('strips ports from bracketed IPv6 and regular hosts', () => {
    expect(stripPort('[::1]:3000')).toBe('[::1]');
    expect(stripPort('[::1]')).toBe('[::1]');
    expect(stripPort('ogabassey.com:443')).toBe('ogabassey.com');
    expect(stripPort('ogabassey.com')).toBe('ogabassey.com');
  });

  it('identifies local development hosts', () => {
    expect(isLocalhostIdentifier('localhost')).toBe(true);
    expect(isLocalhostIdentifier('127.0.0.1')).toBe(true);
    expect(isLocalhostIdentifier('[::1]')).toBe(true);
    expect(isLocalhostIdentifier('ogabassey.localhost')).toBe(false);
  });

  it('resolves route identifiers from root-domain subdomains and custom domains', () => {
    expect(
      resolveStorefrontRouteIdentifier({
        request: new Request(
          'https://ogabassey.usebaci.com/agent-commerce.json'
        ),
        rootDomain: 'usebaci.com',
      })
    ).toBe('ogabassey');
    expect(
      resolveStorefrontRouteIdentifier({
        request: new Request('https://ogabassey.com/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toBe('ogabassey.com');
  });

  it('returns an empty identifier for platform and localhost hosts', () => {
    expect(
      resolveStorefrontRouteIdentifier({
        request: new Request('https://usebaci.com/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toBe('');
    expect(
      resolveStorefrontRouteIdentifier({
        request: new Request('http://[::1]:3000/agent-commerce.json', {
          headers: { host: '[::1]:3000' },
        }),
        rootDomain: 'usebaci.com',
      })
    ).toBe('');
  });
});
