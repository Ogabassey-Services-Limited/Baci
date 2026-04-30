export const PAYMENT_GATEWAYS = ['paystack', 'korapay', 'juicyway'] as const;

export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const PAYMENT_GATEWAY_LABELS = {
  paystack: 'Paystack',
  korapay: 'Korapay',
  juicyway: 'Juicyway',
} satisfies Record<PaymentGateway, string>;

export const isPaymentGateway = (value: unknown): value is PaymentGateway =>
  typeof value === 'string' &&
  PAYMENT_GATEWAYS.includes(value as PaymentGateway);

export const PAYMENT_KINDS = {
  ORDER: 'order',
  VTU: 'vtu',
} as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[keyof typeof PAYMENT_KINDS];

export const isPlainRecord = (
  value: unknown
): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const isPaymentCompletionRedirect = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.pathname.endsWith('/checkout/success') ||
      parsedUrl.pathname.endsWith('/order-success') ||
      parsedUrl.searchParams.has('trxref')
    );
  } catch {
    return false;
  }
};

export const isPaymentCancellationRedirect = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.searchParams.get('cancelled') === 'true' ||
      parsedUrl.searchParams.get('cancel') === 'true' ||
      parsedUrl.pathname.split('/').includes('cancel')
    );
  } catch {
    return false;
  }
};
