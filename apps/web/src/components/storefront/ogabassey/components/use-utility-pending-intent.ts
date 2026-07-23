'use client';

import { useEffect } from 'react';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { isWalletFundingCheckLoopEnabled } from '@/lib/wallet-funding-check-loop-flag';

export const UTILITY_PENDING_INTENT_STORAGE_KEY =
  'baci:utility-pending-intent';

/**
 * The airtime/data purchase a customer had typed when they left to fund their
 * wallet. Persisted to sessionStorage so a reload — or a mobile browser
 * evicting the backgrounded tab while they are in their bank app — doesn't lose
 * it. Amounts stay strings: this is a form draft for PREFILL only, never a
 * payload that gets submitted on its own.
 */
export interface UtilityPendingIntent {
  amount: string;
  networkProvider: string | null;
  phoneNumber: string;
  tab: 'airtime' | 'data';
}

/**
 * The persisted shape adds the owning customer id. sessionStorage is shared by
 * every customer/merchant that signs in on the same tab, so a bare draft would
 * let customer A's airtime entry prefill customer B's form after a sign-out or
 * account switch. The id is validated on read and a foreign record is cleared
 * rather than consumed — mirroring the mobile `wallet-funding-intent` fix.
 */
interface PersistedUtilityPendingIntent extends UtilityPendingIntent {
  customerId: string;
}

interface UseUtilityPendingIntentReturn {
  clearIntent: () => void;
  intent: UtilityPendingIntent | null;
  saveIntent: (intent: UtilityPendingIntent) => void;
}

function isPersistedUtilityPendingIntent(
  value: PersistedUtilityPendingIntent | null
): value is PersistedUtilityPendingIntent {
  // sessionStorage is untrusted input: a hand-edited, stale-shaped or
  // owner-less entry must be ignored, not prefilled into a real-money form.
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.customerId === 'string' &&
    value.customerId.length > 0 &&
    (value.tab === 'airtime' || value.tab === 'data') &&
    typeof value.amount === 'string' &&
    typeof value.phoneNumber === 'string' &&
    (value.networkProvider === null ||
      typeof value.networkProvider === 'string')
  );
}

/**
 * Resume snapshot for the utility purchase a wallet-funding detour interrupts,
 * SCOPED to the customer signed in right now. A no-op while the check-loop flag
 * is off: nothing is written and nothing is read back, so the modal behaves
 * exactly as it does in production today.
 *
 * Pass the active customer id. A stored record that belongs to a DIFFERENT
 * customer (an account switch or sign-out in the same tab) is never returned
 * and is cleared on read, so it cannot linger and leak. While the id is still
 * unknown (`undefined`, e.g. auth hydrating) the record is neither shown nor
 * destroyed — it may still be the same customer's.
 */
export function useUtilityPendingIntent(
  customerId: string | undefined
): UseUtilityPendingIntentReturn {
  const [stored, setStored, clearIntent] =
    usePersistedState<PersistedUtilityPendingIntent | null>(
      UTILITY_PENDING_INTENT_STORAGE_KEY,
      null
    );
  const enabled = isWalletFundingCheckLoopEnabled();

  const persisted = isPersistedUtilityPendingIntent(stored) ? stored : null;
  const ownedByActiveCustomer =
    persisted !== null &&
    Boolean(customerId) &&
    persisted.customerId === customerId;

  // A record that is malformed or owned by another customer must never prefill
  // the active customer's money form. Clear it on read instead of consuming it,
  // but only once the active customer is known.
  useEffect(() => {
    if (!enabled || !customerId || stored === null) return;
    if (!ownedByActiveCustomer) {
      clearIntent();
    }
  }, [clearIntent, customerId, enabled, ownedByActiveCustomer, stored]);

  return {
    clearIntent,
    intent:
      enabled && ownedByActiveCustomer && persisted
        ? {
            amount: persisted.amount,
            networkProvider: persisted.networkProvider,
            phoneNumber: persisted.phoneNumber,
            tab: persisted.tab,
          }
        : null,
    saveIntent: (next) => {
      if (!enabled || !customerId) return;
      setStored({ ...next, customerId });
    },
  };
}
