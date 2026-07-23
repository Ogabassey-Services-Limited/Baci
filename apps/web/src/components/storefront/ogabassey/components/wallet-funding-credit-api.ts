import {
  type WalletCreditPollTransaction,
  walletCreditPollResponseSchema,
} from '@/schemas/wallet-credit-poll';

type WalletCreditPollResult =
  | {
      balance: number | null;
      kind: 'ready';
      transactions: WalletCreditPollTransaction[];
    }
  | { kind: 'error' };

/**
 * Module-scope network helper (mirrors `usdt-wallet-funding-api`): keeps the
 * async try/catch out of the polling hook so React Compiler can optimize it.
 * Every failure mode — non-2xx, network error, schema violation — collapses to
 * `{ kind: 'error' }`, which the caller treats as "no credit seen yet".
 */
async function poll(
  merchantSlug: string,
  signal?: AbortSignal
): Promise<WalletCreditPollResult> {
  try {
    const response = await fetch(
      `/api/storefront/customer/wallet?merchant=${encodeURIComponent(merchantSlug)}`,
      { signal }
    );
    if (!response.ok) {
      return { kind: 'error' };
    }
    const parsed = walletCreditPollResponseSchema.safeParse(
      await response.json()
    );
    if (!parsed.success) {
      return { kind: 'error' };
    }
    return {
      balance: parsed.data.balance ?? null,
      kind: 'ready',
      transactions: parsed.data.transactions,
    };
  } catch {
    return { kind: 'error' };
  }
}

export const walletFundingCreditApi = { poll };
