import { resolveLocationStateLabel } from '@baci/shared/lib';
import Constants from 'expo-constants';
import {
  getPreferredShippingQuoteId,
  normalizeShippingQuotes,
} from '@/lib/shipping-quotes';
import type { CartItem } from '@/stores/cart-store';
import type { ShippingQuote } from './types';

const expoMerchantId = Constants.expoConfig?.extra?.merchantId;
const MERCHANT_ID =
  typeof expoMerchantId === 'string' && expoMerchantId.trim()
    ? expoMerchantId.trim()
    : undefined;

export interface QuoteResponse {
  quotes: {
    all: ShippingQuote[];
  };
}

export interface ShippingLocation {
  city: string;
  state: string;
}

export type FetchQuotesArgs = {
  apiUrl: string;
  state: string;
  city: string;
  items: CartItem[];
  customer: { email?: string } | null;
  watchedFirstName: string;
  watchedLastName: string;
  watchedPhone: string;
  watchedAddress: string;
  watchedEmail: string;
  setIsLoadingQuotes: (value: boolean) => void;
  setSelectedQuoteId: (value: string) => void;
  setResolvedShippingQuoteContextKey: (value: string) => void;
  setShippingQuotes: (value: ShippingQuote[]) => void;
  previousSelectedQuoteId?: string | null;
  quoteContextKey: string;
  shouldResetSelection: boolean;
  signal?: AbortSignal;
};

export function normalizeStateName(
  googleState: string,
  knownStates: string[]
): string {
  return resolveLocationStateLabel(googleState, knownStates);
}

export const fetchShippingQuotes = async ({
  apiUrl,
  state,
  city,
  items,
  customer,
  watchedFirstName,
  watchedLastName,
  watchedPhone,
  watchedAddress,
  watchedEmail,
  setIsLoadingQuotes,
  setSelectedQuoteId,
  setResolvedShippingQuoteContextKey,
  setShippingQuotes,
  previousSelectedQuoteId,
  quoteContextKey,
  shouldResetSelection,
  signal,
}: FetchQuotesArgs) => {
  if (!state || !city || items.length === 0) return;

  setIsLoadingQuotes(true);
  if (shouldResetSelection) {
    setShippingQuotes([]);
    setSelectedQuoteId('');
    setResolvedShippingQuoteContextKey('');
  }

  try {
    const response = await fetch(`${apiUrl}/api/shipping/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(MERCHANT_ID ? { merchantId: MERCHANT_ID } : {}),
        receiver: {
          name:
            `${watchedFirstName} ${watchedLastName}`.trim() ||
            'Valued Customer',
          email: customer?.email || watchedEmail || 'guest@example.com',
          phone: watchedPhone || '',
          address: watchedAddress || `${city}, ${state}`,
          city,
          state,
          country: 'Nigeria',
        },
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          value: item.negotiatedPrice ?? item.price,
          // Cart lines do not currently persist package weight; backend quotes
          // expect a numeric value, so we keep the existing conservative default.
          weight: 1,
        })),
      }),
      signal,
    });

    if (signal?.aborted) return;

    if (response.ok) {
      const data: QuoteResponse & { warnings?: string[] } =
        await response.json();
      const quotes = normalizeShippingQuotes(data.quotes?.all || []);
      setShippingQuotes(quotes);
      setResolvedShippingQuoteContextKey(quoteContextKey);
      setSelectedQuoteId(
        getPreferredShippingQuoteId(quotes, previousSelectedQuoteId)
      );
    } else if (shouldResetSelection) {
      setShippingQuotes([]);
      setSelectedQuoteId('');
      setResolvedShippingQuoteContextKey('');
    }
  } catch (_error) {
    if (signal?.aborted) return;
    if (shouldResetSelection) {
      setShippingQuotes([]);
      setSelectedQuoteId('');
      setResolvedShippingQuoteContextKey('');
    }
  } finally {
    if (!signal?.aborted) {
      setIsLoadingQuotes(false);
    }
  }
};
