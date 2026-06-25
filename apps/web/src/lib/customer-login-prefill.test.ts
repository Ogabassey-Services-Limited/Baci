import { describe, expect, it, vi } from 'vitest';
import {
  fetchCustomerLoginEmailPrefillForRedirect,
  getReceiptClaimTokenFromLoginRedirect,
  sanitizeCustomerLoginEmailPrefill,
} from './customer-login-prefill';

describe('sanitizeCustomerLoginEmailPrefill', () => {
  it('normalizes valid email hints for login prefill', () => {
    expect(
      sanitizeCustomerLoginEmailPrefill('  BasseyBJohn@Yahoo.CO.UK  ')
    ).toBe('basseybjohn@yahoo.co.uk');
  });

  it('drops missing or invalid email hints', () => {
    expect(sanitizeCustomerLoginEmailPrefill(null)).toBe('');
    expect(sanitizeCustomerLoginEmailPrefill('not-an-email')).toBe('');
    expect(sanitizeCustomerLoginEmailPrefill('https://evil.example')).toBe('');
  });
});

describe('getReceiptClaimTokenFromLoginRedirect', () => {
  it('extracts receipt claim tokens from safe login redirects', () => {
    expect(
      getReceiptClaimTokenFromLoginRedirect('/receipts/claim/token_123')
    ).toBe('token_123');
    expect(
      getReceiptClaimTokenFromLoginRedirect(
        '/receipts/claim/token_123?from=email'
      )
    ).toBe('token_123');
  });

  it('ignores non-claim redirects', () => {
    expect(getReceiptClaimTokenFromLoginRedirect('/receipts')).toBeNull();
    expect(
      getReceiptClaimTokenFromLoginRedirect('/account?redirect=/receipts')
    ).toBeNull();
  });
});

describe('fetchCustomerLoginEmailPrefillForRedirect', () => {
  it('loads and sanitizes the email hint for receipt claim redirects', async () => {
    const fetchImpl = (_url: string | URL | Request) =>
      Promise.resolve(
        new Response(
          JSON.stringify({ emailHint: '  BasseyBJohn@Yahoo.CO.UK  ' }),
          { status: 200 }
        )
      );

    await expect(
      fetchCustomerLoginEmailPrefillForRedirect(
        '/receipts/claim/token_123',
        fetchImpl
      )
    ).resolves.toBe('basseybjohn@yahoo.co.uk');
  });

  it('does not fetch email hints for non-claim redirects', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      fetchCustomerLoginEmailPrefillForRedirect('/receipts', fetchImpl)
    ).resolves.toBe('');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('drops failed or invalid email hint responses', async () => {
    const failedFetch = () =>
      Promise.resolve(new Response(null, { status: 404 }));
    const invalidEmailFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ emailHint: 'not-an-email' }), {
          status: 200,
        })
      );

    await expect(
      fetchCustomerLoginEmailPrefillForRedirect(
        '/receipts/claim/token_123',
        failedFetch
      )
    ).resolves.toBe('');
    await expect(
      fetchCustomerLoginEmailPrefillForRedirect(
        '/receipts/claim/token_123',
        invalidEmailFetch
      )
    ).resolves.toBe('');
  });

  it('handles email hint fetch failures', async () => {
    const fetchImpl = () => Promise.reject(new Error('network failed'));

    await expect(
      fetchCustomerLoginEmailPrefillForRedirect(
        '/receipts/claim/token_123',
        fetchImpl
      )
    ).resolves.toBe('');
  });
});
