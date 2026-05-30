import { jest } from '@jest/globals';
import {
  buildMobileCheckoutFingerprint,
  clearMobileCheckoutIdempotencyKey,
  getMobileCheckoutIdempotencyKey,
  type MobileCheckoutIdempotencyState,
} from './checkout-order-idempotency';

const mockRandomUUID = jest.fn();

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockRandomUUID(),
}));

const baseInput = {
  customerEmail: 'Ada@Example.com ',
  customerName: ' Ada Lovelace ',
  customerPhone: ' 08031234567 ',
  deliveryMethod: 'pickup_station',
  discountAmount: 0,
  items: [
    {
      assuranceFee: 0,
      hasAssurance: false,
      id: 'prod-b',
      price: 2000,
      productId: 'prod-b',
      quantity: 1,
      variantId: null,
    },
    {
      assuranceFee: 100,
      hasAssurance: true,
      id: 'prod-a',
      price: 1000,
      productId: 'prod-a',
      quantity: 2,
      variantAttributes: { Color: 'Blue', Storage: '128GB' },
      variantId: 'variant-a',
    },
  ],
  savingsAmount: 0,
  savingsGoalId: null,
  selectedQuoteId: null,
  shippingAddress: {
    address: 'No. 5 Example Plaza',
    city: 'Lagos',
    firstName: 'Ada',
    lastName: 'Lovelace',
    notes: '',
    state: 'Lagos',
  },
  shippingFee: 2000,
  shippingProvider: 'pickup_station',
  subtotal: 4000,
  taxAmount: 0,
  walletAmount: 0,
};

describe('checkout-order-idempotency', () => {
  beforeEach(() => {
    mockRandomUUID.mockReset();
    mockRandomUUID
      .mockReturnValueOnce('mobile-key-1')
      .mockReturnValueOnce('mobile-key-2');
  });

  it('builds the same fingerprint when only item order changes', () => {
    const first = buildMobileCheckoutFingerprint(baseInput);
    const second = buildMobileCheckoutFingerprint({
      ...baseInput,
      items: [...baseInput.items].reverse(),
    });

    expect(second).toBe(first);
  });

  it('builds the same fingerprint for reordered duplicate product and variant lines', () => {
    const blueLine = {
      assuranceFee: 100,
      hasAssurance: true,
      id: 'prod-a',
      price: 1000,
      productId: 'prod-a',
      quantity: 1,
      variantAttributes: { Color: 'Blue', Storage: '128GB' },
      variantId: 'variant-a',
    };
    const greenLine = {
      assuranceFee: 0,
      hasAssurance: false,
      id: 'prod-a',
      price: 1100,
      productId: 'prod-a',
      quantity: 2,
      variantAttributes: { Color: 'Green', Storage: '256GB' },
      variantId: 'variant-a',
    };

    const first = buildMobileCheckoutFingerprint({
      ...baseInput,
      items: [blueLine, greenLine],
    });
    const second = buildMobileCheckoutFingerprint({
      ...baseInput,
      items: [greenLine, blueLine],
    });

    expect(second).toBe(first);
  });

  it('normalizes empty optional shipping fields consistently', () => {
    const withNulls = buildMobileCheckoutFingerprint({
      ...baseInput,
      selectedQuoteId: null,
      shippingProvider: null,
    });
    const withUndefined = buildMobileCheckoutFingerprint({
      ...baseInput,
      selectedQuoteId: undefined,
      shippingProvider: undefined,
    });
    const withEmptyStrings = buildMobileCheckoutFingerprint({
      ...baseInput,
      selectedQuoteId: ' ',
      shippingProvider: '',
    });

    expect(withUndefined).toBe(withNulls);
    expect(withEmptyStrings).toBe(withNulls);
  });

  it('collapses repeated whitespace while normalizing text fields', () => {
    const withExtraWhitespace = buildMobileCheckoutFingerprint({
      ...baseInput,
      customerName: ' Ada   Lovelace ',
      shippingAddress: {
        ...baseInput.shippingAddress,
        address: 'No.  5    Example Plaza',
      },
    });
    const normalized = buildMobileCheckoutFingerprint({
      ...baseInput,
      customerName: 'Ada Lovelace',
      shippingAddress: {
        ...baseInput.shippingAddress,
        address: 'No. 5 Example Plaza',
      },
    });

    expect(withExtraWhitespace).toBe(normalized);
  });

  it('reuses one key while the checkout fingerprint is stable', () => {
    const ref: { current: MobileCheckoutIdempotencyState | null } = {
      current: null,
    };
    const fingerprint = buildMobileCheckoutFingerprint(baseInput);

    expect(getMobileCheckoutIdempotencyKey(ref, fingerprint)).toBe(
      'mobile-key-1'
    );
    expect(getMobileCheckoutIdempotencyKey(ref, fingerprint)).toBe(
      'mobile-key-1'
    );
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });

  it('rotates the key when commercial checkout details change', () => {
    const ref: { current: MobileCheckoutIdempotencyState | null } = {
      current: null,
    };
    const first = buildMobileCheckoutFingerprint(baseInput);
    const second = buildMobileCheckoutFingerprint({
      ...baseInput,
      shippingFee: 3000,
    });

    expect(getMobileCheckoutIdempotencyKey(ref, first)).toBe('mobile-key-1');
    expect(getMobileCheckoutIdempotencyKey(ref, second)).toBe('mobile-key-2');
  });

  it('clears only the matching checkout key when a fingerprint is supplied', () => {
    const ref: { current: MobileCheckoutIdempotencyState | null } = {
      current: null,
    };
    const fingerprint = buildMobileCheckoutFingerprint(baseInput);

    getMobileCheckoutIdempotencyKey(ref, fingerprint);
    clearMobileCheckoutIdempotencyKey(ref, 'different-fingerprint');
    expect(ref.current?.key).toBe('mobile-key-1');

    clearMobileCheckoutIdempotencyKey(ref, fingerprint);
    expect(ref.current).toBeNull();
  });
});
