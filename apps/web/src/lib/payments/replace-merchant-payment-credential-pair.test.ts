import { beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceMerchantPaymentCredentialPair } from './replace-merchant-payment-credential-pair';

vi.mock('server-only', () => ({}));

const mockRpc = vi.hoisted(() => vi.fn());
const mockEncryptSecret = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ rpc: mockRpc })),
}));

vi.mock('@/lib/crypto/secret-box', () => ({
  encryptSecret: mockEncryptSecret,
}));

const input = {
  merchantId: 'merchant-1',
  provider: 'paypal' as const,
  environment: 'live' as const,
  clientId: 'new-client-id-1234',
  secretKey: 'new-secret-key-9876',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEncryptSecret
    .mockReturnValueOnce({ ciphertext: 'client-cipher', kekVersion: 2 })
    .mockReturnValueOnce({ ciphertext: 'secret-cipher', kekVersion: 3 });
});

describe('replaceMerchantPaymentCredentialPair', () => {
  it('encrypts both roles and replaces them through one atomic rpc', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await replaceMerchantPaymentCredentialPair(input);

    expect(mockEncryptSecret).toHaveBeenNthCalledWith(1, input.clientId);
    expect(mockEncryptSecret).toHaveBeenNthCalledWith(2, input.secretKey);
    expect(mockRpc).toHaveBeenCalledWith(
      'replace_merchant_payment_credential_pair',
      {
        p_client_id_ciphertext: 'client-cipher',
        p_client_id_kek_version: 2,
        p_client_id_last4: '1234',
        p_environment: 'live',
        p_merchant_id: 'merchant-1',
        p_provider: 'paypal',
        p_secret_key_ciphertext: 'secret-cipher',
        p_secret_key_kek_version: 3,
        p_secret_key_last4: '9876',
      }
    );
  });

  it('throws a secret-free error when the atomic rpc fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST001', message: 'ciphertext leaked here' },
    });

    let thrown: Error | undefined;
    try {
      await replaceMerchantPaymentCredentialPair(input);
    } catch (error) {
      if (error instanceof Error) {
        thrown = error;
      } else {
        throw error;
      }
    }

    expect(thrown?.message).toMatch(/atomic pair replacement failed/);
    expect(thrown?.message).not.toContain('ciphertext leaked here');
    expect(thrown?.message).not.toContain(input.secretKey);
    expect(thrown?.cause).toEqual({ code: 'PGRST001' });
  });
});
