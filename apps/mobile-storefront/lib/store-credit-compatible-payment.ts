export type StoreCreditPaymentTab = 'full' | 'installments' | 'pay_later';

export type StoreCreditPaymentMethod =
  | 'paystack'
  | 'korapay'
  | 'bank_transfer'
  | 'pay_on_delivery'
  | 'credpal'
  | 'credit_direct'
  | 'klump'
  | 'juicyway'
  | 'invoice'
  | 'payforme';

/**
 * STORE_CREDIT_COMPATIBLE_PAYMENT_METHODS lists full-payment methods that can
 * settle the non-store-credit residual immediately. In this checkout domain,
 * "store credit" means wallet earnings, device savings, or other internal
 * balances applied before gateway settlement; Paystack, Korapay, and bank
 * transfer can still collect any remaining cash amount in the same checkout.
 */
const STORE_CREDIT_COMPATIBLE_PAYMENT_METHODS: ReadonlySet<StoreCreditPaymentMethod> = new Set([
  'paystack',
  'korapay',
  'bank_transfer',
]);

/**
 * isStoreCreditCompatiblePayment returns whether store credit can be combined
 * with the selected payment path. paymentTab must be `full` because
 * installment/pay-later flows create deferred contracts where partially
 * applying internal credit would drift from provider repayment schedules.
 * selectedPayment must be one of the supported checkout methods, and the
 * boolean return value is the shared UI/API guard for wallet and savings
 * payload shaping.
 */
export function isStoreCreditCompatiblePayment({
  paymentTab,
  selectedPayment,
}: {
  paymentTab?: StoreCreditPaymentTab | null;
  selectedPayment?: StoreCreditPaymentMethod | null;
}) {
  return (
    paymentTab === 'full' &&
    selectedPayment != null &&
    STORE_CREDIT_COMPATIBLE_PAYMENT_METHODS.has(selectedPayment)
  );
}
