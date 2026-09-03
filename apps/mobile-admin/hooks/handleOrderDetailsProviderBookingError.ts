import { OrderStatusUpdateError } from './orders/order-status-update-error';

type OrderDetailsGiglShipping = {
  refreshBalance: () => Promise<unknown>;
  requestQuote: () => Promise<unknown>;
};

export async function handleOrderDetailsProviderBookingError(
  error: unknown,
  giglShipping?: OrderDetailsGiglShipping | null
) {
  const code = error instanceof OrderStatusUpdateError ? error.code : undefined;
  if (code === 'MERCHANT_WALLET_INSUFFICIENT') {
    await giglShipping?.refreshBalance();
  }
  if (code === 'MERCHANT_WALLET_QUOTE_RECONFIRM_REQUIRED') {
    await giglShipping?.requestQuote();
  }
}
