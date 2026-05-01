/** WALLET_TOP_UP_MIN_AMOUNT is expressed in NGN naira, not kobo. */
export const WALLET_TOP_UP_MIN_AMOUNT = 100 as const;

/** WALLET_TOP_UP_MAX_AMOUNT is expressed in NGN naira and must match mobile validation. */
export const WALLET_TOP_UP_MAX_AMOUNT = 500_000 as const;
