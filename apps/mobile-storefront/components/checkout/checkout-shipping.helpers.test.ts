import type { CartItem } from '@/stores/cart-store';
import type { ShippingQuote } from './types';
import {
  fetchShippingQuotes,
  normalizeStateName,
} from './checkout-shipping.helpers';

const createCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 'cart-1',
  name: 'iPhone 11 Pro Max',
  price: 470000,
  product_id: 'product-1',
  quantity: 1,
  slug: 'iphone-11-pro-max',
  ...overrides,
});

const createShippingQuote = (
  overrides: Partial<ShippingQuote> = {}
): ShippingQuote => ({
  displayName: 'Topship Standard',
  id: 'quote-1',
  price: 5000,
  provider: 'Topship',
  ...overrides,
});

describe('checkout-shipping.helpers', () => {
  it('normalizes Google state aliases to known shipping state labels', () => {
    expect(normalizeStateName('fct', ['FCT - Abuja', 'Lagos'])).toBe(
      'FCT - Abuja'
    );
    expect(
      normalizeStateName('Lagos State', ['FCT - Abuja', 'Lagos', 'Ogun'])
    ).toBe('Lagos');
  });

  it('returns the trimmed input when no known state match exists', () => {
    expect(normalizeStateName(' Anambra ', ['Lagos', 'Ogun'])).toBe('Anambra');
  });

  it('sets normalized quotes and preferred selection when quote request succeeds', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        quotes: {
          all: [createShippingQuote({ id: 'quote-1', provider: 'Provider A' })],
        },
      }),
      ok: true,
    })) as jest.Mock;

    const setIsLoadingQuotes = jest.fn();
    const setSelectedQuoteId = jest.fn();
    const setResolvedShippingQuoteContextKey = jest.fn();
    const setShippingQuotes = jest.fn();

    await fetchShippingQuotes({
      apiUrl: 'https://example.com',
      city: 'Lagos',
      customer: null,
      items: [createCartItem()],
      quoteContextKey: 'Lagos|Lagos',
      setIsLoadingQuotes,
      setResolvedShippingQuoteContextKey,
      setSelectedQuoteId,
      setShippingQuotes,
      shouldResetSelection: true,
      state: 'Lagos',
      watchedAddress: '1 Marina',
      watchedEmail: 'ada@example.com',
      watchedFirstName: 'Ada',
      watchedLastName: 'Lovelace',
      watchedPhone: '08031234567',
    });

    expect(setIsLoadingQuotes).toHaveBeenCalledWith(true);
    expect(setShippingQuotes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'quote-1',
          provider: 'Provider A',
        }),
      ])
    );
    expect(setResolvedShippingQuoteContextKey).toHaveBeenCalledWith(
      'Lagos|Lagos'
    );
    expect(setSelectedQuoteId).toHaveBeenLastCalledWith('quote-1');
    expect(setIsLoadingQuotes).toHaveBeenLastCalledWith(false);
  });

  it('clears quotes when request fails and selection reset is required', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
    })) as jest.Mock;

    const setIsLoadingQuotes = jest.fn();
    const setSelectedQuoteId = jest.fn();
    const setResolvedShippingQuoteContextKey = jest.fn();
    const setShippingQuotes = jest.fn();

    await fetchShippingQuotes({
      apiUrl: 'https://example.com',
      city: 'Lagos',
      customer: null,
      items: [createCartItem()],
      quoteContextKey: 'Lagos|Lagos',
      setIsLoadingQuotes,
      setResolvedShippingQuoteContextKey,
      setSelectedQuoteId,
      setShippingQuotes,
      shouldResetSelection: true,
      state: 'Lagos',
      watchedAddress: '1 Marina',
      watchedEmail: 'ada@example.com',
      watchedFirstName: 'Ada',
      watchedLastName: 'Lovelace',
      watchedPhone: '08031234567',
    });

    expect(setShippingQuotes).toHaveBeenCalledWith([]);
    expect(setSelectedQuoteId).toHaveBeenCalledWith('');
    expect(setResolvedShippingQuoteContextKey).toHaveBeenCalledWith('');
    expect(setIsLoadingQuotes).toHaveBeenLastCalledWith(false);
  });
});
