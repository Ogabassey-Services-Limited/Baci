export const WALLET_FUNDING_ACCOUNT_MESSAGES = {
  AVAILABILITY_CHECKING: 'Checking account number availability...',
  AVAILABILITY_ERROR:
    'Account number availability could not be checked. Pull to refresh and try again.',
  DVA_DISABLED: 'Bank transfer account creation is not available yet.',
  ORDER_PAYMENT_IN_PROGRESS:
    'Your account number is handling an order payment right now. Complete that payment first, then try again — reservations clear within about 90 minutes.',
  PHONE_REQUIRED:
    'Add a phone number to your profile before creating a wallet account number.',
} as const;

/**
 * Server message fragment for WALLET_DVA_ORDER_ALIAS_CONFLICT (the shared
 * API client surfaces the message string, not the error code): the
 * customer's Paystack NUBAN is inside an active order-payment reservation
 * window, so it cannot double as a wallet funding account until it clears.
 */
export const ORDER_ALIAS_CONFLICT_MESSAGE_FRAGMENT =
  'reserved for an active order payment';

/**
 * Server error code (HTTP 400) from POST
 * /api/storefront/customer/wallet/funding-account when the customer row has no
 * phone. The shared API client attaches it as `error.code`; the mobile outcome
 * resolver maps it to the phone prompt instead of a dead-end Alert, covering
 * stale-local-state races where the client still shows a phone.
 */
export const CUSTOMER_PHONE_REQUIRED_ERROR_CODE = 'CUSTOMER_PHONE_REQUIRED';
