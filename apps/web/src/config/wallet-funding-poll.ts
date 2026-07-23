/**
 * Timing for the wallet bank-transfer "I've transferred — checking…" loop.
 *
 * `intervalMs` matches the proven USDT funding poll (5s). `maxAttempts` bounds
 * the loop at ~5 minutes of FOREGROUND checking — polls are skipped (and not
 * counted) while the tab is hidden, because the customer is in their bank app
 * during exactly that window. Hitting the cap times out; it never credits.
 *
 * `requestTimeoutMs` bounds each individual wallet GET: on a degraded
 * connection a request can stall indefinitely, so it is aborted after this
 * window. A stalled request therefore always settles (as an error, never a
 * credit), which lets the attempt budget advance and the overall loop still
 * time out instead of piling up unresolved requests.
 *
 * `deadlineMs` is an absolute wall-clock bound on FOREGROUND checking time,
 * measured from the moment the loop is armed and paused while the tab is hidden
 * (the customer is in their bank app). `maxAttempts` alone assumes ~5s per
 * attempt, but a run of slow-but-completing requests stretches each attempt to
 * `requestTimeoutMs`, so 60 attempts could otherwise occupy ~10 minutes. This
 * deadline caps the visible "checking…" state at ~5 minutes regardless of
 * per-request timing; hitting it times out, it never credits.
 */
export const WALLET_FUNDING_POLL = {
  deadlineMs: 300_000,
  intervalMs: 5_000,
  maxAttempts: 60,
  requestTimeoutMs: 10_000,
} as const;
