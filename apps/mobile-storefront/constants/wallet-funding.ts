export const WALLET_FUNDING_POLLING = {
  INTERVAL_MS: 5000,
  TIMEOUT_MS: 120000,
} as const;

/**
 * Client-side dark-launch kill-switch for the wallet "I've transferred —
 * checking…" acknowledgement loop and the utility→wallet round-trip CTA.
 * There is no client feature-flag system in this app, so this constant gates
 * the new surfaces; flip to `true` to enable. Keep `false` until launch.
 */
export const WALLET_FUNDING_CHECKING_STATE_ENABLED = false;
