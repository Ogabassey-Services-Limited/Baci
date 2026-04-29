export const PAYMENT_GATEWAY_LABELS: Record<string, string> = {
  paystack: 'Paystack',
  korapay: 'Korapay',
  juicyway: 'Juicyway',
};

export const PAYMENT_KINDS = {
  ORDER: 'order',
  VTU: 'vtu',
} as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[keyof typeof PAYMENT_KINDS];

export const isPaymentGatewayRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
