export const PAYMENT_GATEWAY_LABELS: Record<string, string> = {
  paystack: 'Paystack',
  korapay: 'Korapay',
  juicyway: 'Juicyway',
};

export const isPaymentGatewayRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isPaymentCompletionRedirect = (url: string) => {
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
