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

  it('rewrites verified staff invite links to the native invite route', () => {
    expect(
      rewriteBaciDeepLinkPath('https://usebaci.com/invite/token-123')
    ).toBe('/invite/token-123');
    expect(
      rewriteBaciDeepLinkPath('https://www.usebaci.com/invite/token-123')
    ).toBe('/invite/token-123');
    expect(
      rewriteBaciDeepLinkPath('baciadmin://invite/token-123?accept=1')
    ).toBe('/invite/token-123?accept=1');
    expect(rewriteBaciDeepLinkPath('baciadmin:///invite/token-123')).toBe(
      '/invite/token-123'
    );
  });

  it('leaves unrelated app routes unchanged', () => {
    expect(rewriteBaciDeepLinkPath('baciadmin://orders?tab=pending')).toBe(
      'baciadmin://orders?tab=pending'
    );
    expect(rewriteBaciDeepLinkPath('https://usebaci.com/orders')).toBe(
      'https://usebaci.com/orders'
    );
    expect(rewriteBaciDeepLinkPath('https://evil.example/invite/token')).toBe(
      'https://evil.example/invite/token'
    );
  });

  it('does not rewrite relative or partial dashboard paths', () => {
    expect(rewriteBaciDeepLinkPath('/dashboard')).toBe('/dashboard');
    expect(rewriteBaciDeepLinkPath('baciadmin://dashboarding')).toBe(
      'baciadmin://dashboarding'
    );
    expect(rewriteBaciDeepLinkPath('https://usebaci.com/dashboarding')).toBe(
      'https://usebaci.com/dashboarding'
    );
  });

  it('returns the original path when url parsing fails', () => {
    expect(rewriteBaciDeepLinkPath('https://%')).toBe('https://%');
  });
});
