import { describe, expect, it } from 'vitest';
import { joinRouteBasePath, normalizeRouteBasePath } from './routes';

describe('normalizeRouteBasePath', () => {
  it('trims whitespace and normalizes leading and trailing slashes', () => {
    expect(normalizeRouteBasePath(' ogabassey/ ')).toBe('/ogabassey');
    expect(normalizeRouteBasePath('/ogabassey/')).toBe('/ogabassey');
  });

  it('returns an empty route base path for root and blank inputs', () => {
    expect(normalizeRouteBasePath('')).toBe('');
    expect(normalizeRouteBasePath('   ')).toBe('');
    expect(normalizeRouteBasePath('/')).toBe('');
  });
});

describe('joinRouteBasePath', () => {
  it('resolves root paths to an absolute root href when base path is empty', () => {
    expect(joinRouteBasePath('', '/')).toBe('/');
  });

  it('resolves root paths to the normalized base path when present', () => {
    expect(joinRouteBasePath('/ogabassey/', '/')).toBe('/ogabassey');
  });

  it('joins relative and absolute paths without duplicate slashes', () => {
    expect(joinRouteBasePath('ogabassey/', 'products')).toBe(
      '/ogabassey/products'
    );
    expect(joinRouteBasePath('/ogabassey/', '/products')).toBe(
      '/ogabassey/products'
    );
  });

  it('joins internal paths onto absolute canonical base URLs', () => {
    expect(
      joinRouteBasePath('https://ogabassey.usebaci.com', '/blog/first-post')
    ).toBe('https://ogabassey.usebaci.com/blog/first-post');
    expect(joinRouteBasePath('http://localhost:3000/ogabassey/', 'blog')).toBe(
      'http://localhost:3000/ogabassey/blog'
    );
  });

  it('resolves root paths against absolute canonical base URLs', () => {
    expect(joinRouteBasePath('https://ogabassey.usebaci.com/', '/')).toBe(
      'https://ogabassey.usebaci.com'
    );
    expect(joinRouteBasePath('http://localhost:3000/ogabassey/', '')).toBe(
      'http://localhost:3000/ogabassey'
    );
  });

  it('leaves external URLs unchanged', () => {
    expect(joinRouteBasePath('/ogabassey', 'https://example.com')).toBe(
      'https://example.com'
    );
  });
});
