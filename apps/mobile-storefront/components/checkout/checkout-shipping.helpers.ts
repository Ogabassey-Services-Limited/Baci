import {
  getPreferredShippingQuoteId,
  normalizeShippingQuotes,
} from '@/lib/shipping-quotes';
import type { CartItem } from '@/stores/cart-store';
import type { ShippingQuote } from './types';

export interface QuoteResponse {
  quotes: {
    all: ShippingQuote[];
  };
}

export interface ShippingLocation {
  city: string;
  state: string;
}

const GOOGLE_STATE_ALIASES: Record<string, string> = {
  'federal capital territory': 'FCT - Abuja',
  fct: 'FCT - Abuja',
  abuja: 'FCT - Abuja',
  'lagos state': 'Lagos',
  'rivers state': 'Rivers',
  'ogun state': 'Ogun',
  'oyo state': 'Oyo',
  'kano state': 'Kano',
  'kaduna state': 'Kaduna',
  'enugu state': 'Enugu',
  'delta state': 'Delta',
  'edo state': 'Edo',
  'anambra state': 'Anambra',
};

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
  const trimmed = googleState.trim();
  if (knownStates.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const exactMatch = knownStates.find((state) => state.toLowerCase() === lower);
  if (exactMatch) return exactMatch;
  const alias = GOOGLE_STATE_ALIASES[lower];
  if (alias && knownStates.includes(alias)) return alias;
  const withoutSuffix = lower.replace(/\s+state$/i, '');
  const suffixMatch = knownStates.find(
    (state) => state.toLowerCase() === withoutSuffix
  );
  if (suffixMatch) return suffixMatch;
  return trimmed;
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
      const data: QuoteResponse & { warnings?: string[] } = await response.json();
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
