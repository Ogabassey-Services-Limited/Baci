import { afterEach, describe, expect, it, vi } from 'vitest';

// `server-only` throws unconditionally outside a Server Component bundle —
// stub it so the module under test can load in Vitest.
vi.mock('server-only', () => ({}));

const mockRpc = vi.hoisted(() => vi.fn());
const mockEncryptSecret = vi.hoisted(() => vi.fn());
const mockDecryptSecret = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ rpc: mockRpc })),
}));

vi.mock('@/lib/crypto/secret-box', () => ({
  decryptSecret: mockDecryptSecret,
  encryptSecret: mockEncryptSecret,
}));

import {
  deleteMerchantCredentials,
  getDecryptedMerchantCredential,
  getMerchantPaymentCredentialMeta,
  markMerchantCredentialInvalid,
  setMerchantPaymentCredential,
  touchMerchantCredentialValidated,
} from './merchant-credentials';

const MERCHANT_ID = 'merchant-1';

describe('setMerchantPaymentCredential', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('encrypts the plaintext, derives key_last4, and upserts via the rpc', async () => {
    // Arrange
    mockEncryptSecret.mockReturnValue({
      ciphertext: 'cipher123',
      kekVersion: 1,
    });
    mockRpc.mockResolvedValueOnce({ data: 'credential-id-1', error: null });

    // Act
    const result = await setMerchantPaymentCredential(
      MERCHANT_ID,
      'stripe',
      'secret_key',
      'live',
      'rk_live_abc123'
    );

    // Assert
    expect(result).toBe('credential-id-1');
    expect(mockEncryptSecret).toHaveBeenCalledWith('rk_live_abc123');
    expect(mockRpc).toHaveBeenCalledWith('set_merchant_payment_credential', {
      p_ciphertext: 'cipher123',
      p_credential_role: 'secret_key',
      p_environment: 'live',
      p_kek_version: 1,
      p_key_last4: 'c123',
      p_merchant_id: MERCHANT_ID,
      p_provider: 'stripe',
    });
  });

  it('throws a secret-free error when the rpc errors', async () => {
    // Arrange
    const plaintext = 'super-secret-plaintext-999';
    mockEncryptSecret.mockReturnValue({
      ciphertext: 'cipherXYZ',
      kekVersion: 1,
    });
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'db exploded' },
    });

    // Act
    let thrown: Error | undefined;
    try {
      await setMerchantPaymentCredential(
        MERCHANT_ID,
        'stripe',
        'secret_key',
        'live',
        plaintext
      );
    } catch (error) {
      thrown = error as Error;
    }

    // Assert
    expect(thrown?.message).toMatch(
      /set_merchant_payment_credential failed: db exploded/
    );
    expect(thrown?.message).not.toContain(plaintext);
  });

  it('throws when the rpc reports success but returns no credential id', async () => {
    // Arrange
    mockEncryptSecret.mockReturnValue({
      ciphertext: 'cipher123',
      kekVersion: 1,
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    // Act & Assert
    await expect(
      setMerchantPaymentCredential(
        MERCHANT_ID,
        'paypal',
        'client_id',
        'test',
        'abcd'
      )
    ).rejects.toThrow(/returned no credential id/);
  });
});

describe('getMerchantPaymentCredentialMeta', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns redacted metadata rows and never touches decryptSecret', async () => {
    // Arrange
    const rows = [
      {
        credential_role: 'client_id' as const,
        disabled_at: null,
        environment: 'live' as const,
        is_active: true,
        key_last4: 'abcd',
        last_validated_at: null,
        last_validation_error: null,
      },
    ];
    mockRpc.mockResolvedValueOnce({ data: rows, error: null });

    // Act
    const result = await getMerchantPaymentCredentialMeta(
      MERCHANT_ID,
      'paypal'
    );

    // Assert
    expect(result).toEqual(rows);
    expect(mockRpc).toHaveBeenCalledWith(
      'get_merchant_payment_credential_meta',
      {
        p_merchant_id: MERCHANT_ID,
        p_provider: 'paypal',
      }
    );
    expect(mockDecryptSecret).not.toHaveBeenCalled();
  });

  it('returns an empty array when the rpc returns no rows', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    // Act
    const result = await getMerchantPaymentCredentialMeta(
      MERCHANT_ID,
      'paypal'
    );

    // Assert
    expect(result).toEqual([]);
    expect(mockDecryptSecret).not.toHaveBeenCalled();
  });

  it('throws when the rpc errors', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'meta lookup boom' },
    });

    // Act & Assert
    await expect(
      getMerchantPaymentCredentialMeta(MERCHANT_ID, 'paypal')
    ).rejects.toThrow(
      /get_merchant_payment_credential_meta failed: meta lookup boom/
    );
    expect(mockDecryptSecret).not.toHaveBeenCalled();
  });
});

describe('getDecryptedMerchantCredential', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('decrypts the active row returned by the rpc', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({
      data: [{ ciphertext: 'cipherXYZ', kek_version: 2 }],
      error: null,
    });
    mockDecryptSecret.mockReturnValue('rk_live_decrypted_value');

    // Act
    const result = await getDecryptedMerchantCredential(
      MERCHANT_ID,
      'stripe',
      'secret_key',
      'live'
    );

    // Assert
    expect(result).toBe('rk_live_decrypted_value');
    expect(mockDecryptSecret).toHaveBeenCalledWith('cipherXYZ', 2);
    expect(mockRpc).toHaveBeenCalledWith(
      'get_merchant_payment_credential_ciphertext',
      {
        p_credential_role: 'secret_key',
        p_environment: 'live',
        p_merchant_id: MERCHANT_ID,
        p_provider: 'stripe',
      }
    );
  });

  it('fails closed and never decrypts when the rpc errors', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'ciphertext lookup boom' },
    });

    // Act & Assert
    await expect(
      getDecryptedMerchantCredential(
        MERCHANT_ID,
        'stripe',
        'secret_key',
        'live'
      )
    ).rejects.toThrow(
      /get_merchant_payment_credential_ciphertext failed: ciphertext lookup boom/
    );
    expect(mockDecryptSecret).not.toHaveBeenCalled();
  });

  it('fails closed and never decrypts when there is no active row', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    // Act & Assert
    await expect(
      getDecryptedMerchantCredential(
        MERCHANT_ID,
        'stripe',
        'secret_key',
        'live'
      )
    ).rejects.toThrow(/no active secret_key credential for provider stripe/);
    expect(mockDecryptSecret).not.toHaveBeenCalled();
  });

  it('propagates a decrypt failure without ever returning a fallback value', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({
      data: [{ ciphertext: 'tampered', kek_version: 1 }],
      error: null,
    });
    mockDecryptSecret.mockImplementation(() => {
      throw new Error(
        'secret-box: failed to decrypt — authentication failed or ciphertext is corrupted.'
      );
    });

    // Act & Assert
    await expect(
      getDecryptedMerchantCredential(
        MERCHANT_ID,
        'stripe',
        'secret_key',
        'live'
      )
    ).rejects.toThrow(/failed to decrypt/);
  });
});

describe('markMerchantCredentialInvalid', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls the rpc with the disable reason', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    // Act
    await markMerchantCredentialInvalid(
      MERCHANT_ID,
      'stripe',
      'secret_key',
      'live',
      'provider rejected the key'
    );

    // Assert
    expect(mockRpc).toHaveBeenCalledWith(
      'mark_merchant_payment_credential_invalid',
      {
        p_credential_role: 'secret_key',
        p_environment: 'live',
        p_error: 'provider rejected the key',
        p_merchant_id: MERCHANT_ID,
        p_provider: 'stripe',
      }
    );
  });

  it('throws when the rpc errors', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'mark invalid boom' },
    });

    // Act & Assert
    await expect(
      markMerchantCredentialInvalid(
        MERCHANT_ID,
        'stripe',
        'secret_key',
        'live',
        'bad key'
      )
    ).rejects.toThrow(
      /mark_merchant_payment_credential_invalid failed: mark invalid boom/
    );
  });
});

describe('touchMerchantCredentialValidated', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stamps ONLY the environment that was validated, never the other one', async () => {
    // Arrange — validating sandbox must not mark never-checked live keys as good
    // (readiness/publish would then launch PayPal on credentials that fail at a
    // real customer checkout).
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    // Act
    await touchMerchantCredentialValidated(MERCHANT_ID, 'paypal', 'test');

    // Assert
    expect(mockRpc).toHaveBeenCalledWith(
      'touch_merchant_payment_credential_validated',
      {
        p_merchant_id: MERCHANT_ID,
        p_provider: 'paypal',
        p_environment: 'test',
      }
    );
  });

  it('throws when the rpc errors', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'touch boom' },
    });

    // Act & Assert
    await expect(
      touchMerchantCredentialValidated(MERCHANT_ID, 'paypal', 'live')
    ).rejects.toThrow(
      /touch_merchant_payment_credential_validated failed: touch boom/
    );
  });
});

describe('deleteMerchantCredentials', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls the rpc for the merchant and provider', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    // Act
    await deleteMerchantCredentials(MERCHANT_ID, 'flutterwave');

    // Assert
    expect(mockRpc).toHaveBeenCalledWith('delete_merchant_payment_credential', {
      p_merchant_id: MERCHANT_ID,
      p_provider: 'flutterwave',
    });
  });

  it('throws when the rpc errors', async () => {
    // Arrange
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'delete boom' },
    });

    // Act & Assert
    await expect(
      deleteMerchantCredentials(MERCHANT_ID, 'flutterwave')
    ).rejects.toThrow(/delete_merchant_payment_credential failed: delete boom/);
  });
});
