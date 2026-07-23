import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_FUNDING_TELEMETRY } from '@/lib/posthog/wallet-funding-events';
import { requestFundingAccount } from './wallet-funding-account-request';
import { WALLET_FUNDING_COPY } from './wallet-funding-copy';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

function jsonResponse(
  body: Record<string, unknown>,
  init: { ok?: boolean } = {}
) {
  return {
    ok: init.ok ?? true,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('requestFundingAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the created account on a successful response', async () => {
    const account = { accountNumber: '1234567890', provider: 'paystack' };
    mockFetchWithCsrf.mockResolvedValue(jsonResponse({ account }));

    const result = await requestFundingAccount('ogabassey');

    expect(result).toEqual({ kind: 'created', account });
  });

  it('surfaces the order-reservation copy for a NUBAN conflict', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(
        { code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT' },
        { ok: false }
      )
    );

    const result = await requestFundingAccount('ogabassey');

    // The conflict code is a known server reason, passed through verbatim.
    expect(result).toMatchObject({
      kind: 'error',
      message: WALLET_FUNDING_COPY.orderPaymentInProgress,
    });
  });

  it('passes a server error message through with a resolved reason', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(
        { error: 'Merchant wallet is disabled', code: 'WALLET_DVA_DISABLED' },
        { ok: false }
      )
    );

    const result = await requestFundingAccount('ogabassey');

    expect(result.kind).toBe('error');
    expect(result).toMatchObject({ message: 'Merchant wallet is disabled' });
  });

  it('falls back to unavailable copy when the error body has no message', async () => {
    mockFetchWithCsrf.mockResolvedValue(jsonResponse({}, { ok: false }));

    const result = await requestFundingAccount('ogabassey');

    expect(result).toMatchObject({
      kind: 'error',
      message: WALLET_FUNDING_COPY.unavailable,
    });
  });

  it('reports a network reason when the request throws', async () => {
    mockFetchWithCsrf.mockRejectedValue(new Error('offline'));

    const result = await requestFundingAccount('ogabassey');

    expect(result).toEqual({
      kind: 'error',
      message: WALLET_FUNDING_COPY.unavailable,
      reason: WALLET_FUNDING_TELEMETRY.reasons.network,
    });
  });
});
