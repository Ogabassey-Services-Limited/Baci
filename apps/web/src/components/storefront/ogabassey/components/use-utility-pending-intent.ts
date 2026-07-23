'use client';

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

interface UseUtilityPendingIntentReturn {
  clearIntent: () => void;
  intent: UtilityPendingIntent | null;
  saveIntent: (intent: UtilityPendingIntent) => void;
}

function isUtilityPendingIntent(
  value: UtilityPendingIntent | null
): value is UtilityPendingIntent {
  // sessionStorage is untrusted input: a hand-edited or stale-shaped entry must
  // be ignored, not prefilled into a real-money form.
  return (
    value !== null &&
    typeof value === 'object' &&
    (value.tab === 'airtime' || value.tab === 'data') &&
    typeof value.amount === 'string' &&
    typeof value.phoneNumber === 'string' &&
    (value.networkProvider === null ||
      typeof value.networkProvider === 'string')
  );
}

/**
 * Resume snapshot for the utility purchase a wallet-funding detour interrupts.
 * A no-op while the check-loop flag is off: nothing is written and nothing is
 * read back, so the modal behaves exactly as it does in production today.
 */
export function useUtilityPendingIntent(): UseUtilityPendingIntentReturn {
  const [intent, setIntent, clearIntent] =
    usePersistedState<UtilityPendingIntent | null>(
      UTILITY_PENDING_INTENT_STORAGE_KEY,
      null
    );
  const enabled = isWalletFundingCheckLoopEnabled();

  return {
    clearIntent,
    intent: enabled && isUtilityPendingIntent(intent) ? intent : null,
    saveIntent: (next) => {
      if (!enabled) return;
      setIntent(next);
    },
  };
}
