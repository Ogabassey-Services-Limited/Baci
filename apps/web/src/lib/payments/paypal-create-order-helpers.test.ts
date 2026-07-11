import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFreshNgnPerUsdt } from '@/lib/juicyway/rates';
import { getOrder } from '@/lib/paypal';
import {
  getReusablePayPalOrderId,
  isPaypalOrderApprovable,
  pickPaypalApprovalUrl,
  resolvePaypalPresentment,
  resolveReusablePaypalApproval,
  validateSameOriginUrl,
} from './paypal-create-order-helpers';

const RATE_CACHE_TTL_MS = 5 * 60 * 1000;

vi.mock('@/lib/juicyway/rates', () => ({
  getFreshNgnPerUsdt: vi.fn(),
  RATE_CACHE_TTL_MS: 5 * 60 * 1000,
}));

vi.mock('@/lib/paypal', () => ({
  getOrder: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('validateSameOriginUrl', () => {
  it('returns undefined when no url is provided', () => {
    expect(
      validateSameOriginUrl(undefined, 'https://a.example')
    ).toBeUndefined();
  });

  it('returns the normalized url when the origin matches', () => {
    expect(
      validateSameOriginUrl(
        'https://a.example/checkout?x=1',
        'https://a.example'
      )
    ).toBe('https://a.example/checkout?x=1');
  });

  it('throws on a cross-origin url', () => {
    expect(() =>
      validateSameOriginUrl('https://evil.example/steal', 'https://a.example')
    ).toThrow();
  });
});

describe('getReusablePayPalOrderId', () => {
  const metadata = {
    paypal_presentment_amount: 100,
    paypal_presentment_currency: 'USD',
  };

  it('reuses when presentment amount and currency match', () => {
    expect(
      getReusablePayPalOrderId(
        { gateway_reference: 'PP-1', metadata },
        100,
        'USD'
      )
    ).toBe('PP-1');
  });

  it('returns null when the amount moved beyond tolerance', () => {
    expect(
      getReusablePayPalOrderId(
        { gateway_reference: 'PP-1', metadata },
        105,
        'USD'
      )
    ).toBeNull();
  });

  it('returns null when the currency differs', () => {
    expect(
      getReusablePayPalOrderId(
        { gateway_reference: 'PP-1', metadata },
        100,
        'EUR'
      )
    ).toBeNull();
  });

  it('returns null when there is no gateway_reference', () => {
    expect(getReusablePayPalOrderId({ metadata }, 100, 'USD')).toBeNull();
  });
});

describe('resolvePaypalPresentment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('presents a non-NGN currency as-is with fxRate 1', async () => {
    const result = await resolvePaypalPresentment('USD', 42);

    expect(result).toEqual({
      ok: true,
      presentmentAmount: 42,
      presentmentCurrency: 'USD',
      fxRate: 1,
    });
    expect(getFreshNgnPerUsdt).not.toHaveBeenCalled();
  });

  it('fails closed for a non-NGN currency PayPal cannot present', async () => {
    expect(await resolvePaypalPresentment('KES', 4200)).toEqual({
      ok: false,
      reason: 'unsupported_currency',
    });
    expect(getFreshNgnPerUsdt).not.toHaveBeenCalled();
  });

  it('converts NGN to USD using a FRESH live rate (not a stale-tolerant one)', async () => {
    vi.mocked(getFreshNgnPerUsdt).mockResolvedValue(1300);

    const result = await resolvePaypalPresentment('NGN', 130000);

    expect(result).toEqual({
      ok: true,
      presentmentAmount: 100,
      presentmentCurrency: 'USD',
      fxRate: 1300,
    });
    // The NGN path MUST require freshness (bounded by the cache TTL) so a stale
    // rate can never silently convert — this is the fail-closed guarantee.
    expect(getFreshNgnPerUsdt).toHaveBeenCalledWith(RATE_CACHE_TTL_MS);
  });

  it('fails closed (fx_unavailable) when only a STALE cached rate is available', async () => {
    // getFreshNgnPerUsdt throws when the live fetch fails and the only cache it
    // holds is older than the freshness window (proven in rates.test.ts). The
    // presentment must map that to fx_unavailable — NOT convert at a stale rate.
    vi.mocked(getFreshNgnPerUsdt).mockRejectedValue(
      new Error(
        'Unable to fetch a fresh NGN/USDT exchange rate. Please try again.'
      )
    );

    expect(await resolvePaypalPresentment('NGN', 130000)).toEqual({
      ok: false,
      reason: 'fx_unavailable',
    });
    expect(getFreshNgnPerUsdt).toHaveBeenCalledWith(RATE_CACHE_TTL_MS);
  });

  it('fails closed when the live rate fetch throws', async () => {
    vi.mocked(getFreshNgnPerUsdt).mockRejectedValue(
      new Error('coingecko down')
    );

    expect(await resolvePaypalPresentment('NGN', 130000)).toEqual({
      ok: false,
      reason: 'fx_unavailable',
    });
  });

  it('fails closed when the live rate is non-positive', async () => {
    vi.mocked(getFreshNgnPerUsdt).mockResolvedValue(0);

    expect(await resolvePaypalPresentment('NGN', 130000)).toEqual({
      ok: false,
      reason: 'fx_unavailable',
    });
  });
});

describe('isPaypalOrderApprovable', () => {
  it('accepts CREATED, PAYER_ACTION_REQUIRED and APPROVED (case-insensitive)', () => {
    expect(isPaypalOrderApprovable('CREATED')).toBe(true);
    expect(isPaypalOrderApprovable('payer_action_required')).toBe(true);
    expect(isPaypalOrderApprovable(' Approved ')).toBe(true);
  });

  it('rejects consumed/terminal statuses', () => {
    expect(isPaypalOrderApprovable('COMPLETED')).toBe(false);
    expect(isPaypalOrderApprovable('VOIDED')).toBe(false);
    expect(isPaypalOrderApprovable('')).toBe(false);
  });
});

describe('pickPaypalApprovalUrl', () => {
  it('returns the approve or payer-action link href', () => {
    expect(
      pickPaypalApprovalUrl({
        links: [
          { rel: 'self', href: 'https://api/self' },
          { rel: 'payer-action', href: 'https://paypal/pay' },
        ],
      })
    ).toBe('https://paypal/pay');
  });

  it('returns undefined when there is no approval link', () => {
    expect(pickPaypalApprovalUrl({ links: [] })).toBeUndefined();
    expect(pickPaypalApprovalUrl({})).toBeUndefined();
  });
});

describe('resolveReusablePaypalApproval', () => {
  const credentials = { clientId: 'cid', secretKey: 'sk' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the approval url when the stored order is still approvable', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: {
        id: 'PP-1',
        status: 'CREATED',
        links: [
          { rel: 'approve', href: 'https://paypal/approve', method: 'GET' },
        ],
      },
    });

    expect(
      await resolveReusablePaypalApproval(credentials, 'PP-1', 'sandbox')
    ).toBe('https://paypal/approve');
    expect(getOrder).toHaveBeenCalledWith('cid', 'sk', 'PP-1', 'sandbox');
  });

  it('returns null when the getOrder lookup fails', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      success: false,
      error: 'not found',
      code: 'HTTP_404',
    });

    expect(
      await resolveReusablePaypalApproval(credentials, 'PP-1', 'sandbox')
    ).toBeNull();
  });

  it('returns null when the stored order is no longer approvable', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: {
        id: 'PP-1',
        status: 'COMPLETED',
        links: [
          { rel: 'approve', href: 'https://paypal/approve', method: 'GET' },
        ],
      },
    });

    expect(
      await resolveReusablePaypalApproval(credentials, 'PP-1', 'sandbox')
    ).toBeNull();
  });

  it('returns null when an approvable order has no approval link', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-1', status: 'CREATED', links: [] },
    });

    expect(
      await resolveReusablePaypalApproval(credentials, 'PP-1', 'sandbox')
    ).toBeNull();
  });
});
