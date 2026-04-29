import { describe, expect, it } from 'vitest';
import {
  buildRequestBaseUrl,
  getRequestHost,
  isLocalhostIdentifier,
  resolveStorefrontRouteIdentifier,
  resolveStorefrontRouteIdentifiers,
  stripPort,
} from '@/lib/storefront-host';

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
    expect(
      resolveStorefrontRouteIdentifier({
        request: new Request('https://www.ogabassey.com/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toBe('www.ogabassey.com');
  });

  it('returns appropriate lookup candidates for various host types', () => {
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request('https://www.ogabassey.com/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toEqual(['ogabassey.com', 'www.ogabassey.com']);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request('https://ogabassey.com/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toEqual(['ogabassey.com']);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request(
          'https://ogabassey.usebaci.com/agent-commerce.json'
        ),
        rootDomain: 'usebaci.com',
      })
    ).toEqual(['ogabassey']);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request(
          'https://shop.ogabassey.usebaci.com/agent-commerce.json'
        ),
        rootDomain: 'usebaci.com',
      })
    ).toEqual(['shop.ogabassey']);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request('https://ogabassey.localhost/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toEqual(['ogabassey.localhost']);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request('https://usebaci.com/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toEqual([]);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request('https://www.usebaci.com/agent-commerce.json'),
        rootDomain: 'usebaci.com',
      })
    ).toEqual([]);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request(
          'https://shop.ogabassey.co.uk/agent-commerce.json'
        ),
        rootDomain: 'usebaci.com',
      })
    ).toEqual(['shop.ogabassey.co.uk']);
    expect(
      resolveStorefrontRouteIdentifiers({
        request: new Request(
          'https://www.shop.ogabassey.co.uk/agent-commerce.json'
        ),
        rootDomain: 'usebaci.com',
      })
    ).toEqual(['shop.ogabassey.co.uk', 'www.shop.ogabassey.co.uk']);
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
        request: new Request('https://www.usebaci.com/agent-commerce.json'),
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

  it('throws for invalid request inputs outside the Request contract', () => {
    expect(() =>
      resolveStorefrontRouteIdentifiers({
        request: null as unknown as Request,
        rootDomain: 'usebaci.com',
      })
    ).toThrow(TypeError);
    expect(() =>
      resolveStorefrontRouteIdentifiers({
        request: {
          headers: new Headers(),
          url: 'not a valid url',
        } as unknown as Request,
        rootDomain: 'usebaci.com',
      })
    ).toThrow(TypeError);
    expect(() =>
      resolveStorefrontRouteIdentifiers({
        request: { url: 'https://ogabassey.com' } as unknown as Request,
        rootDomain: 'usebaci.com',
      })
    ).toThrow(TypeError);
  });
});
