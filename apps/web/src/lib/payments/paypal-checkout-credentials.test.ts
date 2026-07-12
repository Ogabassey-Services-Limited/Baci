import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDecryptedMerchantCredential,
  markMerchantCredentialInvalid,
} from './merchant-credentials';
import {
  getPaypalCheckoutCredentials,
  getPaypalClientId,
  isPaypalAuthFailure,
  markPaypalCredentialInvalid,
  readPaypalFeatureConfig,
} from './paypal-checkout-credentials';
import { disablePaypalFeatureFlag } from './paypal-feature-flag';

vi.mock('server-only', () => ({}));

vi.mock('./merchant-credentials', () => ({
  getDecryptedMerchantCredential: vi.fn(),
  markMerchantCredentialInvalid: vi.fn(),
}));

vi.mock('./paypal-feature-flag', () => ({
  disablePaypalFeatureFlag: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const MERCHANT_ID = 'merchant-1';

describe('readPaypalFeatureConfig', () => {
  it('maps live mode to the live environment when enabled', () => {
    expect(
      readPaypalFeatureConfig({ paypal_enabled: true, paypal_mode: 'live' })
    ).toEqual({ enabled: true, mode: 'live', environment: 'live' });
  });

  it('defaults missing mode to sandbox/test and reports disabled', () => {
    expect(readPaypalFeatureConfig(null)).toEqual({
      enabled: false,
      mode: 'sandbox',
      environment: 'test',
    });
  });
});

describe('getPaypalCheckoutCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns both decrypted roles for the environment', async () => {
    vi.mocked(getDecryptedMerchantCredential).mockImplementation(
      async (_merchant, _provider, role) =>
        role === 'client_id' ? 'client-abc' : 'secret-xyz'
    );

    expect(await getPaypalCheckoutCredentials(MERCHANT_ID, 'live')).toEqual({
      clientId: 'client-abc',
      secretKey: 'secret-xyz',
    });
  });

  it('returns null (fail closed) when a role is missing', async () => {
    vi.mocked(getDecryptedMerchantCredential).mockRejectedValue(
      new Error('no active client_id credential')
    );

    expect(await getPaypalCheckoutCredentials(MERCHANT_ID, 'live')).toBeNull();
  });
});

describe('getPaypalClientId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the decrypted client id', async () => {
    vi.mocked(getDecryptedMerchantCredential).mockResolvedValue('client-abc');

    expect(await getPaypalClientId(MERCHANT_ID, 'test')).toBe('client-abc');
  });

  it('returns null when the vault has no client id', async () => {
    vi.mocked(getDecryptedMerchantCredential).mockRejectedValue(
      new Error('missing')
    );

    expect(await getPaypalClientId(MERCHANT_ID, 'test')).toBeNull();
  });
});

describe('isPaypalAuthFailure', () => {
  it('is true for HTTP_401', () => {
    expect(isPaypalAuthFailure('HTTP_401')).toBe(true);
  });

  it('is false for other codes', () => {
    expect(isPaypalAuthFailure('HTTP_500')).toBe(false);
    expect(isPaypalAuthFailure(undefined)).toBe(false);
  });
});

describe('markPaypalCredentialInvalid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markMerchantCredentialInvalid).mockResolvedValue();
    vi.mocked(disablePaypalFeatureFlag).mockResolvedValue();
  });

  it('disables the secret_key role for the environment', async () => {
    await markPaypalCredentialInvalid(MERCHANT_ID, 'live', 'unauthorized');

    expect(markMerchantCredentialInvalid).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal',
      'secret_key',
      'live',
      'unauthorized'
    );
  });

  it('does NOT disable the merchant-wide PayPal feature flag on a runtime 401 (credentials:162)', async () => {
    await markPaypalCredentialInvalid(MERCHANT_ID, 'live', 'unauthorized');

    // A single, possibly transient, OAuth 401 must not take the merchant's
    // entire PayPal offline across every environment/customer. The credential
    // mark alone fails checkout closed; flag lifecycle stays with settings.
    expect(disablePaypalFeatureFlag).not.toHaveBeenCalled();
  });

  it('never throws when the RPC fails', async () => {
    vi.mocked(markMerchantCredentialInvalid).mockRejectedValue(
      new Error('rpc down')
    );

    await expect(
      markPaypalCredentialInvalid(MERCHANT_ID, 'live', 'unauthorized')
    ).resolves.toBeUndefined();
  });
});
