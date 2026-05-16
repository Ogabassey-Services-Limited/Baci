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
  USDT: ['TRX', 'ETH', 'MATIC', 'AVAXC'],
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

interface InferredAddressLocation {
  city: string;
  state: string;
}

function normalizeStateToken(value: string): string {
  return value.replace(/\s+state$/i, '').trim().toLowerCase();
}

/**
 * Best-effort manual parser for checkout address input when Places autocomplete
 * does not emit an onSelect payload. Supports common formats like:
 * - "Street, City, State"
 * - "Area, State"
 */
export function inferAddressLocationFromInput(
  address: string,
  shippingStates: string[],
): InferredAddressLocation | null {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const rawState = parts[parts.length - 1];
  const rawCity = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
  if (!rawState || !rawCity) return null;

  const normalizedState = normalizeStateToken(rawState);

  let matchedState = rawState.trim();
  if (shippingStates.length > 0) {
    const exactMatch = shippingStates.find(
      (candidate) => normalizeStateToken(candidate) === normalizedState,
    );
    if (exactMatch) {
      matchedState = exactMatch;
    }
  }

  return {
    city: rawCity,
    state: matchedState,
  };
}

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
