import { describe, expect, it } from '@jest/globals';
import type { ImeiBrandFilter, ImeiServiceTierKey } from '@baci/shared/imei';
import {
  DEFAULT_IMEI_CHECK_ERROR_MESSAGE,
  getPublicVisibleImeiServiceTierKeys,
  hasAdditionalPublicImeiServiceTierKeys,
  resolveImeiCheckFailure,
} from './resolve-imei-check-failure';

describe('resolveImeiCheckFailure', () => {
  it('requests login redirect and key rotation on 401 responses', () => {
    const outcome = resolveImeiCheckFailure({
      currentTierPrice: 1500,
      payload: { code: 'AUTH_REQUIRED', error: 'Unauthorized' },
      responseStatus: 401,
      walletBalance: 500,
    });

    expect(outcome).toEqual({
      errorMessage: null,
      shouldClearIdempotencyKey: true,
      shouldPreserveIdempotencyKey: false,
      shouldRefetchWallet: false,
      shouldRedirectToLogin: true,
      topUpAmount: null,
    });
  });

  it('computes top-up deltas using finite fallback values on 402', () => {
    const outcome = resolveImeiCheckFailure({
      currentTierPrice: 1500,
      payload: {
        balance: 'invalid',
        code: 'WALLET_INSUFFICIENT',
        error: 'Insufficient wallet balance',
        required: 'invalid',
      },
      responseStatus: 402,
      walletBalance: 5000,
    });

    expect(outcome).toEqual({
      errorMessage: null,
      shouldClearIdempotencyKey: true,
      shouldPreserveIdempotencyKey: false,
      shouldRefetchWallet: false,
      shouldRedirectToLogin: false,
      topUpAmount: 0,
    });
  });

  it('preserves idempotency and requests wallet refresh for REFUND_PENDING', () => {
    const outcome = resolveImeiCheckFailure({
      currentTierPrice: 1500,
      payload: { code: 'REFUND_PENDING', error: 'Refund pending' },
      responseStatus: 502,
      walletBalance: 2000,
    });

    expect(outcome).toEqual({
      errorMessage:
        'Lookup failed; your refund is pending. We will credit you within 24h.',
      shouldClearIdempotencyKey: false,
      shouldPreserveIdempotencyKey: true,
      shouldRefetchWallet: true,
      shouldRedirectToLogin: false,
      topUpAmount: null,
    });
  });

  it('clears idempotency and requests wallet refresh for refunded provider failures', () => {
    const outcome = resolveImeiCheckFailure({
      currentTierPrice: 1500,
      payload: { code: 'SICKW_NOT_FOUND', error: 'Provider not found' },
      responseStatus: 404,
      walletBalance: 2000,
    });

    expect(outcome).toEqual({
      errorMessage: 'Lookup failed; your wallet was refunded.',
      shouldClearIdempotencyKey: true,
      shouldPreserveIdempotencyKey: false,
      shouldRefetchWallet: true,
      shouldRedirectToLogin: false,
      topUpAmount: null,
    });
  });

  it('keeps the idempotency key for unresolved 409 conflicts', () => {
    const outcome = resolveImeiCheckFailure({
      currentTierPrice: 1500,
      payload: {
        code: 'IDEMPOTENT_REQUEST_IN_FLIGHT',
        error: 'Duplicate request in progress',
      },
      responseStatus: 409,
      walletBalance: 2000,
    });

    expect(outcome).toEqual({
      errorMessage: 'Duplicate request in progress',
      shouldClearIdempotencyKey: false,
      shouldPreserveIdempotencyKey: true,
      shouldRefetchWallet: false,
      shouldRedirectToLogin: false,
      topUpAmount: null,
    });
  });

  it('falls back to the shared default error for unknown failures', () => {
    const outcome = resolveImeiCheckFailure({
      currentTierPrice: 1500,
      payload: null,
      responseStatus: 500,
      walletBalance: 2000,
    });

    expect(outcome).toEqual({
      errorMessage: DEFAULT_IMEI_CHECK_ERROR_MESSAGE,
      shouldClearIdempotencyKey: true,
      shouldPreserveIdempotencyKey: false,
      shouldRefetchWallet: false,
      shouldRedirectToLogin: false,
      topUpAmount: null,
    });
  });
});

describe('tier visibility helpers', () => {
  it('filters visible tiers down to the public service subset', () => {
    const getVisibleTiers = (): ImeiServiceTierKey[] => [
      'simLock',
      'full',
      'carrier',
    ];

    expect(
      getPublicVisibleImeiServiceTierKeys(getVisibleTiers, 'all', true)
    ).toEqual(['full', 'carrier']);
  });

  it('returns an empty list when no visible public tiers are present', () => {
    const getVisibleTiers = (): ImeiServiceTierKey[] => [
      'simLock',
      'icloudPro',
    ];

    expect(
      getPublicVisibleImeiServiceTierKeys(getVisibleTiers, 'apple', true)
    ).toEqual([]);
  });

  it('detects additional public tiers when expanded mode reveals more options', () => {
    const getVisibleTiers = (
      _brand: ImeiBrandFilter,
      expanded: boolean
    ): ImeiServiceTierKey[] => (expanded ? ['full', 'activation'] : ['full']);

    expect(
      hasAdditionalPublicImeiServiceTierKeys(getVisibleTiers, 'all')
    ).toBe(true);
  });

  it('returns false when collapsed and expanded public tiers are identical', () => {
    const getVisibleTiers = (): ImeiServiceTierKey[] => ['full', 'carrier'];

    expect(
      hasAdditionalPublicImeiServiceTierKeys(getVisibleTiers, 'all')
    ).toBe(false);
  });
});
