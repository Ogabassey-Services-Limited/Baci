import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCaptureServerEvent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/posthog/server', () => ({
  captureServerEvent: mockCaptureServerEvent,
}));

import { creditWalletTopUp } from '@/lib/customer-wallet-top-up';
import { deterministicEventUuid } from '@/lib/posthog/deterministic-event-uuid';

const LEDGER_CREATED_AT = '2026-07-13T09:15:30.500Z';

function createWalletCreditSupabaseMock({
  existingCredit,
  ledgerRow = { created_at: LEDGER_CREATED_AT },
  ledgerRowError,
  rpcResult,
}: {
  existingCredit: {
    balance_after: number | string;
    id: string;
  } | null;
  ledgerRow?: Record<string, unknown> | null;
  ledgerRowError?: Error;
  rpcResult?: unknown;
}) {
  const query: Record<string, unknown> = {};
  const select = vi.fn(() => query);
  const eq = vi.fn(() => query);
  const order = vi.fn(() => query);
  const limit = vi.fn(() => query);
  // Call 1 = the existing-credit idempotency lookup.
  // Call 2 = the ledger `created_at` read that stamps the telemetry timestamp.
  const maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: existingCredit, error: null })
    .mockResolvedValue({
      data: ledgerRowError ? null : ledgerRow,
      error: ledgerRowError ?? null,
    });
  Object.assign(query, { eq, limit, maybeSingle, order, select });

  const rpc = vi.fn().mockResolvedValue({
    data: rpcResult ?? [
      {
        new_balance: '2250',
        success: true,
        transaction_id: 'wallet-credit-2',
      },
    ],
    error: null,
  });
  const from = vi.fn(() => query);

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    from,
    rpc,
  };
}

const walletTopUpInput = {
  amount: 1500,
  customerId: 'customer-1',
  gateway: 'paystack',
  merchantId: 'merchant-1',
  reference: 'WAL-123',
  transactionId: 'payment-tx-1',
};

describe('creditWalletTopUp', () => {
  beforeEach(() => {
    mockCaptureServerEvent.mockClear();
  });

  it('returns an existing wallet credit without calling the RPC again', async () => {
    const { client, rpc } = createWalletCreditSupabaseMock({
      existingCredit: {
        balance_after: '1250.75',
        id: 'wallet-credit-1',
      },
    });

    await expect(
      creditWalletTopUp({ ...walletTopUpInput, supabase: client })
    ).resolves.toEqual({
      balance: 1250.75,
      firstCredit: false,
      reference: 'WAL-123',
      transactionId: 'wallet-credit-1',
    });
    expect(rpc).not.toHaveBeenCalled();
    // A replayed credit must not re-emit the funnel-completion event.
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it('credits the wallet through the idempotent RPC when no credit exists', async () => {
    const { client, rpc } = createWalletCreditSupabaseMock({
      existingCredit: null,
    });

    await expect(
      creditWalletTopUp({ ...walletTopUpInput, supabase: client })
    ).resolves.toEqual({
      balance: 2250,
      firstCredit: true,
      reference: 'WAL-123',
      transactionId: 'wallet-credit-2',
    });
    expect(rpc).toHaveBeenCalledWith('credit_customer_wallet', {
      p_amount: 1500,
      p_customer_id: 'customer-1',
      p_description: 'Wallet top-up via paystack',
      p_merchant_id: 'merchant-1',
      p_source_id: 'payment-tx-1',
      p_source_type: 'wallet_topup',
    });
    // The fresh-credit path is the funnel-completion point. BOTH the uuid and
    // the timestamp derive from the ledger row the RPC returned, so a
    // concurrent loser (handed the same row under the advisory lock) produces a
    // byte-identical dedupe key that PostHog collapses into one event.
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      'wallet_funding_transfer_credited',
      {
        amount: 1500,
        currency: 'NGN',
        customer_id: 'customer-1',
        gateway: 'paystack',
        gateway_reference: 'WAL-123',
        merchant_id: 'merchant-1',
      },
      'customer-1',
      deterministicEventUuid(
        'wallet_funding_transfer_credited:wallet-credit-2'
      ),
      new Date(LEDGER_CREATED_AT)
    );
  });

  it.each([
    ['the created_at lookup errors', { ledgerRowError: new Error('pg down') }],
    ['the ledger row is missing', { ledgerRow: null }],
    ['the created_at value is unusable', { ledgerRow: { created_at: 'nope' } }],
  ])('still captures the credited event without a timestamp when %s', async (_label, overrides) => {
    const { client } = createWalletCreditSupabaseMock({
      existingCredit: null,
      ...overrides,
    });

    // Fail-open: the wallet is already credited, so a timestamp lookup
    // failure must never drop the event or break the money path.
    await expect(
      creditWalletTopUp({ ...walletTopUpInput, supabase: client })
    ).resolves.toEqual({
      balance: 2250,
      reference: 'WAL-123',
      transactionId: 'wallet-credit-2',
    });
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      'wallet_funding_transfer_credited',
      expect.any(Object),
      'customer-1',
      deterministicEventUuid(
        'wallet_funding_transfer_credited:wallet-credit-2'
      ),
      undefined
    );
  });

  it('rejects invalid amounts before querying Supabase', async () => {
    const { client, from, rpc } = createWalletCreditSupabaseMock({
      existingCredit: null,
    });

    await expect(
      creditWalletTopUp({
        ...walletTopUpInput,
        amount: Number.NaN,
        supabase: client,
      })
    ).rejects.toThrow('Top-up amount must be positive');
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
