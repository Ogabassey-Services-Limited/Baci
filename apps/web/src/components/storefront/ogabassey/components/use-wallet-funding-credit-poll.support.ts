import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useWalletFundingCreditPoll } from './use-wallet-funding-credit-poll';

// Shared fixtures for `use-wallet-funding-credit-poll.test.tsx`. Kept in a
// non-`.test` module so the assertion file stays under the 300-line limit.
// `vi.mock`/`vi.hoisted` declarations must remain in the test file (they hoist
// per file); these helpers are mock-independent.

export const topUpCredit = {
  amount: 5000,
  id: 'txn-topup',
  source_type: 'wallet_topup',
  type: 'credit',
};

export function ready(transactions: unknown[]) {
  return { balance: 5000, kind: 'ready', transactions };
}

export function renderPoll(overrides: Record<string, unknown> = {}) {
  const onCredited = vi.fn();
  const view = renderHook(() =>
    useWalletFundingCreditPoll({
      customerId: 'customer-1',
      enabled: true,
      knownTransactionIds: ['txn-old'],
      merchantSlug: 'ogabassey',
      onCredited,
      surface: 'wallet_page',
      ...overrides,
    })
  );
  return { onCredited, ...view };
}
