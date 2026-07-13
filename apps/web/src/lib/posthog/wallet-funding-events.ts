/**
 * Snake_case PostHog event vocabulary for the web wallet bank-transfer (Paystack
 * DVA) funding funnel. Names mirror the mobile-storefront wallet events (e.g.
 * `wallet_funding_account_create_failed`) so the two platforms report into the
 * same funnel. Known reason codes map 1:1 to the funding-account API `code`
 * values; `network` and `other` are synthetic telemetry buckets with no API
 * counterpart (request never reached the API / unrecognized code).
 */
export const WALLET_FUNDING_TELEMETRY = {
  events: {
    surfaceOpened: 'wallet_funding_surface_opened',
    createAttempted: 'wallet_funding_account_create_attempted',
    accountCreated: 'wallet_funding_account_created',
    createFailed: 'wallet_funding_account_create_failed',
    paymentMethodSelected: 'utility_payment_method_selected',
    transferCredited: 'wallet_funding_transfer_credited',
  },
  surfaces: {
    utilityModal: 'utility_modal',
    walletPage: 'wallet_page',
  },
  reasons: {
    orderAliasConflict: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
    customerPhoneRequired: 'CUSTOMER_PHONE_REQUIRED',
    dvaDisabled: 'WALLET_DVA_DISABLED',
    network: 'network',
    other: 'other',
  },
} as const;

export type WalletFundingSurface =
  (typeof WALLET_FUNDING_TELEMETRY.surfaces)[keyof typeof WALLET_FUNDING_TELEMETRY.surfaces];

export type WalletFundingFailureReason =
  (typeof WALLET_FUNDING_TELEMETRY.reasons)[keyof typeof WALLET_FUNDING_TELEMETRY.reasons];
