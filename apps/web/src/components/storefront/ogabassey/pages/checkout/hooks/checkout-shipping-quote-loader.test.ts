import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invalidatePendingQuoteRequests,
  loadCheckoutShippingQuotes,
} from './checkout-shipping-quote-loader';

const receiver = {
  address: '1 Airport Road',
  city: 'Port Harcourt',
  deliveryPreference: 'door' as const,
  email: 'customer@example.com',
  fName: 'Ada',
  lName: 'Lovelace',
  latitude: 4.8156,
  longitude: 7.0498,
  phone: '08012345678',
  state: 'Rivers',
};
const cart = [
  { name: 'iPhone 13', negotiatedPrice: 0, price: 500_000, quantity: 1 },
];

function quoteResponse(id = 'road-quote') {
  return new Response(
    JSON.stringify({
      quotes: {
        all: [
          {
            carrierName: 'GIG Logistics',
            currency: 'NGN',
            displayName: 'GIG Logistics - Home Delivery',
            estimatedDays: 3,
            id,
            insuranceIncluded: true,
            pickupIncluded: true,
            price: 5659,
            provider: 'GIGL',
            serviceTier: 'Standard',
          },
        ],
      },
    }),
    { status: 200 }
  );
}

function createState() {
  return {
    currentRequestKey: '',
    force: false,
    requestSequence: { current: 0 },
    setIsLoadingQuotes: vi.fn(),
    setResolvedQuoteRequestKey: vi.fn(),
    setSelectedQuoteId: vi.fn(),
    setShippingQuotes: vi.fn(),
  };
}

describe('loadCheckoutShippingQuotes', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(quoteResponse());
  });

  it('skips a resolved request unless the caller explicitly retries', async () => {
    const state = createState();

    await loadCheckoutShippingQuotes(receiver, cart, state);
    const resolvedKey = state.setResolvedQuoteRequestKey.mock.calls[0]?.[0];
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(state.setShippingQuotes).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'road-quote' }),
    ]);
    expect(state.setSelectedQuoteId).toHaveBeenLastCalledWith('road-quote');
    const requestBody = JSON.parse(
      String(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body ??
          '{}'
      )
    );
    expect(requestBody).toMatchObject({
      deliveryPreference: 'door',
      items: [expect.objectContaining({ value: 0 })],
      receiver: { latitude: 4.8156, longitude: 7.0498 },
    });

    await loadCheckoutShippingQuotes(receiver, cart, {
      ...state,
      currentRequestKey: resolvedKey,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await loadCheckoutShippingQuotes(receiver, cart, {
      ...state,
      currentRequestKey: resolvedKey,
      force: true,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('refetches when the merchant context changes', async () => {
    const state = createState();
    await loadCheckoutShippingQuotes(
      { ...receiver, merchantId: 'merchant-1' },
      cart,
      state
    );
    const resolvedKey = state.setResolvedQuoteRequestKey.mock.calls[0]?.[0];

    await loadCheckoutShippingQuotes(
      { ...receiver, merchantId: 'merchant-2' },
      cart,
      { ...state, currentRequestKey: resolvedKey }
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['non-successful response', () => Promise.resolve(new Response('bad', { status: 503 }))],
    ['network failure', () => Promise.reject(new Error('offline'))],
  ])('clears stale quotes after a %s', async (_label, fetchResult) => {
    global.fetch = vi.fn(fetchResult);
    const state = createState();

    await loadCheckoutShippingQuotes(receiver, cart, state);

    expect(state.setShippingQuotes).toHaveBeenCalledWith([]);
    expect(state.setResolvedQuoteRequestKey).toHaveBeenCalledWith('');
    expect(state.setSelectedQuoteId).toHaveBeenLastCalledWith('');
    expect(state.setIsLoadingQuotes).toHaveBeenLastCalledWith(false);
  });

  it('does not fetch until the receiver location is complete', async () => {
    const state = createState();

    await loadCheckoutShippingQuotes({ ...receiver, city: '' }, cart, state);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(state.setIsLoadingQuotes).not.toHaveBeenCalled();
  });

  it('ignores a stale response when a newer request finishes first', async () => {
    let resolveFirst: (response: Response) => void = () => undefined;
    let resolveSecond: (response: Response) => void = () => undefined;
    global.fetch = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (resolveFirst = resolve))
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (resolveSecond = resolve))
      );
    const state = createState();
    const firstRequest = loadCheckoutShippingQuotes(receiver, cart, state);
    const secondRequest = loadCheckoutShippingQuotes(
      { ...receiver, city: 'Obio-Akpor' },
      cart,
      state
    );

    resolveSecond(quoteResponse('new-quote'));
    await secondRequest;
    resolveFirst(quoteResponse('stale-quote'));
    await firstRequest;

    expect(state.setShippingQuotes).toHaveBeenCalledTimes(1);
    expect(state.setShippingQuotes).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'new-quote' }),
    ]);
  });

  it('ignores a response after the caller invalidates pending requests', async () => {
    let resolveRequest: (response: Response) => void = () => undefined;
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => (resolveRequest = resolve)),
    );
    const state = createState();
    const pendingRequest = loadCheckoutShippingQuotes(receiver, cart, state);

    invalidatePendingQuoteRequests(state.requestSequence);
    resolveRequest(quoteResponse('stale-quote'));
    await pendingRequest;

    expect(state.setShippingQuotes).not.toHaveBeenCalled();
    expect(state.setSelectedQuoteId).toHaveBeenCalledTimes(1);
    expect(state.setSelectedQuoteId).toHaveBeenCalledWith('');
  });
});
