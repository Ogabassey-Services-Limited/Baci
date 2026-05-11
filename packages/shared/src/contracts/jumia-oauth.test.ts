import { describe, expect, it } from 'vitest';
import {
  BACI_ADMIN_SCHEME,
  buildBaciAdminUrl,
  buildJumiaMobileReturnUrl,
  createJumiaMobileReturnUrl,
  JUMIA_MOBILE_RETURN_PATH,
  JUMIA_MOBILE_RETURN_ROUTE,
  JUMIA_MOBILE_RETURN_URL,
} from './jumia-oauth';

describe('Jumia OAuth contracts', () => {
  it('builds the canonical Jumia mobile return URL', () => {
    expect(BACI_ADMIN_SCHEME).toBe('baciadmin');
    expect(JUMIA_MOBILE_RETURN_PATH).toBe('/sales-channels');
    expect(JUMIA_MOBILE_RETURN_ROUTE).toBe('sales-channels');
    expect(JUMIA_MOBILE_RETURN_URL).toBe('baciadmin://sales-channels');
  });

  it('normalizes leading slashes and appends query params safely', () => {
    expect(
      buildBaciAdminUrl('///sales-channels', {
        error: 'ticket_invalid',
        retry: true,
        attempts: 2,
      })
    ).toBe(
      'baciadmin://sales-channels?error=ticket_invalid&retry=true&attempts=2'
    );
  });

  it('skips nullish params when building the Jumia return URL', () => {
    expect(
      buildJumiaMobileReturnUrl({
        code: 'auth-code',
        ticketId: 'ticket-1',
        ignored: null,
        skipped: undefined,
      })
    ).toBe('baciadmin://sales-channels?code=auth-code&ticketId=ticket-1');
  });

  it('creates a fixed deep-link URL object for the Jumia mobile callback', () => {
    const url = createJumiaMobileReturnUrl({
      error: 'ticket_invalid',
      code: 'auth-code',
    });

    expect(url.origin).toBe('null');
    expect(url.protocol).toBe('baciadmin:');
    expect(url.hostname).toBe('sales-channels');
    expect(url.pathname).toBe('');
    expect(url.searchParams.get('error')).toBe('ticket_invalid');
    expect(url.searchParams.get('code')).toBe('auth-code');
  });

  describe('open-redirect hardening (CodeScanning #1399)', () => {
    it('keeps the baciadmin scheme even when code/ticketId contain URL metacharacters', () => {
      // Attacker-shaped values must remain query-encoded; they cannot change
      // the URL authority because scheme + path are hard-coded constants.
      const url = createJumiaMobileReturnUrl({
        code: 'https://evil.com/?x=',
        ticketId: '//attacker.tld/path',
      });

      expect(url.protocol).toBe('baciadmin:');
      expect(url.hostname).toBe('sales-channels');
      expect(url.searchParams.get('code')).toBe('https://evil.com/?x=');
      expect(url.searchParams.get('ticketId')).toBe('//attacker.tld/path');
      // Stringified URL never names the attacker host in the authority slot.
      expect(url.toString().startsWith('baciadmin://sales-channels?')).toBe(
        true
      );
    });

    it('does not let traversal segments in code escape the query component', () => {
      const url = createJumiaMobileReturnUrl({
        code: '../../etc/passwd',
        ticketId: 'ok',
      });

      expect(url.protocol).toBe('baciadmin:');
      expect(url.hostname).toBe('sales-channels');
      expect(url.pathname).toBe('');
    });

    it('keeps the canonical baciadmin prefix for allowed deep-link paths', () => {
      // The scheme is a hard-coded constant inside createBaciAdminUrl, so the
      // negative path of the allow-list guard isn't reachable from the public
      // API without module mocking. This test pins the positive contract:
      // a well-formed call must produce a baciadmin:// URL.
      const result = buildBaciAdminUrl('/sales-channels');
      expect(result.startsWith('baciadmin://sales-channels')).toBe(true);
    });
  });
});
