const claimingPaymentState = 'claiming_payment';
const resumableStates = ['payment_account_ready', 'order_finalizing'] as const;

export const agenticDvaCutoverConstants = {
  claimStaleMs: 15 * 60 * 1000,
  claimingPaymentState,
  resumableStates,
  sessionSelect:
    'session_id, merchant_id, status, cart_items, currency, subtotal, shipping_cost, total_amount, customer_email, customer_name, customer_phone, shipping_address, shipping_method, order_id, payment_method, payment_provider, payment_reference, virtual_account_bank, virtual_account_name, virtual_account_number, metadata, updated_at',
  supportedCurrency: 'NGN',
  transitionalStates: [claimingPaymentState, ...resumableStates],
} as const;
