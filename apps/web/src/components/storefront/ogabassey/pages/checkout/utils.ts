import type { CryptoChain, CryptoCurrency, ShippingQuote } from './types';

/** Date range string for door delivery (tomorrow to +3 days). */
export function getDeliveryDateRange(): string {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() + 1);
  const end = new Date(today);
  end.setDate(today.getDate() + 3);

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
  };
  return `${start.toLocaleDateString('en-GB', options)} to ${end.toLocaleDateString('en-GB', options)}`;
}

/** Which chains each stablecoin supports. */
export const CRYPTO_CHAIN_SUPPORT: Record<CryptoCurrency, CryptoChain[]> = {
  USDT: ['TRX', 'ETH'],
  USDC: ['ETH', 'MATIC', 'AVAXC'],
};

/** Human-readable chain names. */
export const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  TRX: 'Tron (TRC-20)',
  ETH: 'Ethereum (ERC-20)',
  MATIC: 'Polygon',
  AVAXC: 'Avalanche C-Chain',
};

/** Block explorer address URLs per chain. */
export const CHAIN_EXPLORER_URLS: Record<string, string> = {
  TRX: 'https://tronscan.org/#/address/',
  ETH: 'https://etherscan.io/address/',
  MATIC: 'https://polygonscan.com/address/',
  AVAXC: 'https://snowtrace.io/address/',
};

/** Calculate the delivery cost based on selected method and quote. */
export function calculateDeliveryCost(
  deliveryMethod: 'pickup' | 'door' | 'airport',
  selectedQuoteId: string,
  shippingQuotes: ShippingQuote[],
  airportType: 'delivery' | 'pickup',
): number {
  if (deliveryMethod === 'pickup') return 0;

  if (deliveryMethod === 'door') {
    if (!selectedQuoteId) return 0;
    return (
      shippingQuotes.find((q) => String(q.id) === String(selectedQuoteId))
        ?.price ?? 0
    );
  }

  // Airport
  return airportType === 'delivery' ? 25000 : 20000;
}
