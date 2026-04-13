import { describe, expect, it } from 'vitest';
import { rewriteBaciDeepLinkPath } from './baci-deep-link';

describe('rewriteBaciDeepLinkPath', () => {
  it('rewrites legacy dashboard app links to the root route', () => {
    expect(rewriteBaciDeepLinkPath('baciadmin://dashboard')).toBe('/');
    expect(rewriteBaciDeepLinkPath('baciadmin:///dashboard')).toBe('/');
    expect(rewriteBaciDeepLinkPath('baciadmin://dashboard?param=value')).toBe(
      '/'
    );
  });

  it('rewrites verified web dashboard links to the root route', () => {
    expect(rewriteBaciDeepLinkPath('https://usebaci.com/dashboard')).toBe('/');
    expect(rewriteBaciDeepLinkPath('https://www.usebaci.com/admin')).toBe('/');
    expect(rewriteBaciDeepLinkPath('HTTPS://usebaci.com/Dashboard')).toBe('/');
  });

  it('leaves unrelated app routes unchanged', () => {
    expect(rewriteBaciDeepLinkPath('baciadmin://orders?tab=pending')).toBe(
      'baciadmin://orders?tab=pending'
    );
    expect(rewriteBaciDeepLinkPath('https://usebaci.com/orders')).toBe(
      'https://usebaci.com/orders'
    );
  });
});
