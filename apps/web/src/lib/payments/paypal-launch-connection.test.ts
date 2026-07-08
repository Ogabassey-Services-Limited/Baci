import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockGetMerchantPaymentCredentialMeta = vi.hoisted(() => vi.fn());
vi.mock('./merchant-credentials', () => ({
  getDecryptedMerchantCredential: vi.fn(),
  getMerchantPaymentCredentialMeta: mockGetMerchantPaymentCredentialMeta,
  markMerchantCredentialInvalid: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { isPaypalConnectionValidForLaunch } from './paypal-launch-connection';

const MERCHANT_ID = 'merchant-1';

function activeRow(
  role: 'client_id' | 'secret_key',
  overrides: Partial<{
    environment: 'test' | 'live';
    is_active: boolean;
    last_validated_at: string | null;
    last_validation_error: string | null;
  }> = {}
) {
  return {
    credential_role: role,
    disabled_at: null,
    environment: 'live' as const,
    is_active: true,
    key_last4: '1234',
    last_validated_at: '2026-07-01T00:00:00Z',
    last_validation_error: null,
    ...overrides,
  };
}

describe('isPaypalConnectionValidForLaunch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when paypal is enabled live and both roles are active and validated', async () => {
    mockGetMerchantPaymentCredentialMeta.mockResolvedValue([
      activeRow('client_id'),
      activeRow('secret_key'),
    ]);

    const result = await isPaypalConnectionValidForLaunch(MERCHANT_ID, {
      paypal_enabled: true,
      paypal_mode: 'live',
    });

    expect(result).toBe(true);
    expect(mockGetMerchantPaymentCredentialMeta).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal'
    );
  });

  it('returns false without reading the vault when paypal is not enabled', async () => {
    const result = await isPaypalConnectionValidForLaunch(MERCHANT_ID, {
      paypal_enabled: false,
      paypal_mode: 'live',
    });

    expect(result).toBe(false);
    expect(mockGetMerchantPaymentCredentialMeta).not.toHaveBeenCalled();
  });

  it('returns false without reading the vault when only configured in sandbox mode', async () => {
    const result = await isPaypalConnectionValidForLaunch(MERCHANT_ID, {
      paypal_enabled: true,
      paypal_mode: 'sandbox',
    });

    expect(result).toBe(false);
    expect(mockGetMerchantPaymentCredentialMeta).not.toHaveBeenCalled();
  });

  it('returns false when the secret_key role has never been stored', async () => {
    mockGetMerchantPaymentCredentialMeta.mockResolvedValue([
      activeRow('client_id'),
    ]);

    const result = await isPaypalConnectionValidForLaunch(MERCHANT_ID, {
      paypal_enabled: true,
      paypal_mode: 'live',
    });

    expect(result).toBe(false);
  });

  it('returns false when a role was disabled after a failed validation (401)', async () => {
    mockGetMerchantPaymentCredentialMeta.mockResolvedValue([
      activeRow('client_id'),
      activeRow('secret_key', {
        is_active: false,
        last_validation_error: 'HTTP_401',
      }),
    ]);

    const result = await isPaypalConnectionValidForLaunch(MERCHANT_ID, {
      paypal_enabled: true,
      paypal_mode: 'live',
    });

    expect(result).toBe(false);
  });

  it('returns false when only a test-environment credential exists for a live-mode merchant', async () => {
    mockGetMerchantPaymentCredentialMeta.mockResolvedValue([
      activeRow('client_id', { environment: 'test' }),
      activeRow('secret_key', { environment: 'test' }),
    ]);

    const result = await isPaypalConnectionValidForLaunch(MERCHANT_ID, {
      paypal_enabled: true,
      paypal_mode: 'live',
    });

    expect(result).toBe(false);
  });

  it('fails closed and returns false when the vault read throws', async () => {
    mockGetMerchantPaymentCredentialMeta.mockRejectedValue(
      new Error('rpc down')
    );

    const result = await isPaypalConnectionValidForLaunch(MERCHANT_ID, {
      paypal_enabled: true,
      paypal_mode: 'live',
    });

    expect(result).toBe(false);
  });
});
