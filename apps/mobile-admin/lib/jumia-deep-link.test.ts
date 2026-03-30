import { describe, expect, it } from 'vitest';
import { rewriteJumiaDeepLinkPath } from './jumia-deep-link';

describe('rewriteJumiaDeepLinkPath', () => {
  it('rewrites bare Jumia callback query links to the marketplaces route', () => {
    expect(rewriteJumiaDeepLinkPath('baciadmin://?error=ticket_invalid')).toBe(
      '/sales-channels?error=ticket_invalid'
    );
  });

  it('rewrites legacy triple-slashed Jumia callback links', () => {
    expect(
      rewriteJumiaDeepLinkPath(
        'baciadmin:///sales-channels?code=auth-code&ticketId=ticket-1'
      )
    ).toBe('/sales-channels?code=auth-code&ticketId=ticket-1');
  });

  it('rewrites canonical host-based Jumia callback links', () => {
    expect(
      rewriteJumiaDeepLinkPath(
        'baciadmin://sales-channels?code=auth-code&ticketId=ticket-1'
      )
    ).toBe('/sales-channels?code=auth-code&ticketId=ticket-1');
  });

  it('returns the original input when deep-link parsing fails', () => {
    expect(rewriteJumiaDeepLinkPath('baciadmin://%zz')).toBe(
      'baciadmin://%zz'
    );
  });

  it('leaves unrelated deep links unchanged', () => {
    expect(rewriteJumiaDeepLinkPath('baciadmin://orders?tab=pending')).toBe(
      'baciadmin://orders?tab=pending'
    );
  });
});
