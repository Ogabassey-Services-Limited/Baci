import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import type { WalletCreditPollTransaction } from '@/schemas/wallet-credit-poll';
import type { WalletCreditPollResult } from './wallet-funding-credit-api';
import {
  useWalletFundingCreditPoll,
  type UseWalletFundingCreditPollOptions,
} from './use-wallet-funding-credit-poll';

// Shared fixtures for `use-wallet-funding-credit-poll.test.tsx`. Kept in a
// non-`.test` module so the assertion file stays under the 300-line limit.
// `vi.mock`/`vi.hoisted` declarations must remain in the test file (they hoist
// per file); these helpers are mock-independent.

// Typed against the real wallet response contract so a fixture that drifts from
// the schema (e.g. a mistyped `source_type`) fails to compile instead of
// silently passing a shape the runtime detection would reject.
export const topUpCredit: WalletCreditPollTransaction = {
  amount: 5000,
  id: 'txn-topup',
  source_type: 'wallet_topup',
  type: 'credit',
};

export function ready(
  transactions: WalletCreditPollTransaction[]
): WalletCreditPollResult {
  return { balance: 5000, kind: 'ready', transactions };
}

export function renderPoll(
  overrides: Partial<
    Omit<UseWalletFundingCreditPollOptions, 'onCredited'>
  > = {}
) {
  const onCredited = vi.fn();
  const view = renderHook((props: typeof overrides = overrides) =>
    useWalletFundingCreditPoll({
      customerId: 'customer-1',
      enabled: true,
      knownTransactionIds: ['txn-old'],
      merchantSlug: 'ogabassey',
      surface: 'wallet_page',
      ...props,
      // Assigned AFTER the spread so no override can clobber the returned spy —
      // `renderPoll()` must always return the callback the hook actually invokes.
      onCredited,
    })
  );
  return { onCredited, ...view };
}
