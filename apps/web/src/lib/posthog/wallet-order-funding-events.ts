/**
 * Snake_case PostHog vocabulary for the WEB wallet-funded bank-transfer
 * checkout (P4a). Deliberately tiny: the existing wallet funnel constants live
 * in `wallet-funding-events.ts` and already cover DVA provisioning
 * (`wallet_funding_account_*`) and the credit itself
 * (`wallet_funding_transfer_credited`, emitted server-side by
 * `creditWalletTopUp`). Only the two order-scoped transitions that had no
 * event are added here.
 *
 * `wallet_order_funding_fallback` is the one that matters operationally: it is
 * how we see, per reason code, which customers were pushed back onto the
 * legacy order-DVA path after the intent API declined.
 */
export const WALLET_ORDER_FUNDING_TELEMETRY = {
  events: {
    intentCreated: 'wallet_order_funding_intent_created',
    fallback: 'wallet_order_funding_fallback',
  },
} as const;

export type WalletOrderFundingEvent =
  (typeof WALLET_ORDER_FUNDING_TELEMETRY.events)[keyof typeof WALLET_ORDER_FUNDING_TELEMETRY.events];
