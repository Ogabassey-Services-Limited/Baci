/**
 * Timing for the wallet bank-transfer "I've transferred — checking…" loop.
 *
 * `intervalMs` matches the proven USDT funding poll (5s). `maxAttempts` bounds
 * the loop at ~5 minutes of FOREGROUND checking — polls are skipped (and not
 * counted) while the tab is hidden, because the customer is in their bank app
 * during exactly that window. Hitting the cap times out; it never credits.
 */
export const WALLET_FUNDING_POLL = {
  intervalMs: 5_000,
  maxAttempts: 60,
} as const;
