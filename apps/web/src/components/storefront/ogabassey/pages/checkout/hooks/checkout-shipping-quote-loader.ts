import { normalizeShippingQuoteResponse } from '@/lib/shipping/quote-response';
import type { ShippingQuote } from '../types';
import { getPreferredDoorQuoteId } from '../utils';

const CHECKOUT_QUOTE_TIMEOUT_MS = 15_000;

interface QuoteCartItem {
  name: string;
  quantity: number;
  price: number;
  negotiatedPrice?: number;
}

interface QuoteReceiver {
  address: string;
  state: string;
  city: string;
  phone: string;
  fName: string;
  lName: string;
  email: string;
  merchantId?: string;
  deliveryPreference: 'door' | 'pickup_station';
  latitude?: number;
  longitude?: number;
}

interface QuoteState {
  currentRequestKey: string;
  force: boolean;
  requestSequence: { current: number };
  setIsLoadingQuotes: (loading: boolean) => void;
  setResolvedQuoteRequestKey: (key: string) => void;
  setSelectedQuoteId: (id: string) => void;
  setShippingQuotes: (quotes: ShippingQuote[]) => void;
}

export function invalidatePendingQuoteRequests(requestSequence: {
  current: number;
}) {
  requestSequence.current += 1;
  return requestSequence.current;
}

function buildQuoteRequestKey(receiver: QuoteReceiver, cart: QuoteCartItem[]) {
  return JSON.stringify({
    address: receiver.address.trim().toLowerCase(),
    city: receiver.city.trim().toLowerCase(),
    deliveryPreference: receiver.deliveryPreference,
    merchantId: receiver.merchantId ?? null,
    items: cart.map((item) => [
      item.name,
      item.quantity,
      item.negotiatedPrice ?? item.price,
    ]),
    state: receiver.state.trim().toLowerCase(),
    latitude: receiver.latitude,
    longitude: receiver.longitude,
  });
}

export async function loadCheckoutShippingQuotes(
  receiver: QuoteReceiver,
  cart: QuoteCartItem[],
  state: QuoteState,
) {
  if (!receiver.state || !receiver.city || !receiver.address) return;
  const requestKey = buildQuoteRequestKey(receiver, cart);
  if (!state.force && requestKey === state.currentRequestKey) return;
  const requestSequence = invalidatePendingQuoteRequests(state.requestSequence);
  const isLatestRequest = () => state.requestSequence.current === requestSequence;

  state.setIsLoadingQuotes(true);
  state.setSelectedQuoteId('');

  try {
    const signal = AbortSignal.timeout(CHECKOUT_QUOTE_TIMEOUT_MS);
    const response = await fetch('/api/shipping/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliveryPreference: receiver.deliveryPreference,
        merchantId: receiver.merchantId || undefined,
        receiver: {
          name:
            `${receiver.fName} ${receiver.lName}`.trim() || 'Valued Customer',
          email: receiver.email || 'guest@example.com',
          phone: receiver.phone || '',
          address: receiver.address,
          city: receiver.city,
          state: receiver.state,
          country: 'Nigeria',
          ...(Number.isFinite(receiver.latitude) &&
          Number.isFinite(receiver.longitude)
            ? {
                latitude: receiver.latitude,
                longitude: receiver.longitude,
              }
            : {}),
        },
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          weight: 1,
          value: item.negotiatedPrice ?? item.price,
        })),
      }),
      signal,
    });

    if (response.ok) {
      const data: unknown = await response.json();
      if (!isLatestRequest()) return;
      const { quotes } = normalizeShippingQuoteResponse(data);
      state.setShippingQuotes(quotes);
      state.setResolvedQuoteRequestKey(requestKey);
      const preferredQuoteId =
        receiver.deliveryPreference === 'pickup_station'
          ? quotes.find((quote) => quote.isStationPickup)?.id
          : getPreferredDoorQuoteId(quotes);
      if (preferredQuoteId) state.setSelectedQuoteId(String(preferredQuoteId));
    } else {
      console.warn('Failed to fetch quotes:', await response.text());
      if (isLatestRequest()) clearQuotes(state);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.warn('Shipping quote request timed out');
    } else {
      console.error('Error fetching shipping quotes:', error);
    }
    if (isLatestRequest()) clearQuotes(state);
  } finally {
    if (isLatestRequest()) state.setIsLoadingQuotes(false);
  }
}

function clearQuotes(state: QuoteState) {
  state.setShippingQuotes([]);
  state.setResolvedQuoteRequestKey('');
  state.setSelectedQuoteId('');
}
