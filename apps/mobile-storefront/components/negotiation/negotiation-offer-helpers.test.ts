import {
  buildSuccessButtonStyles,
  computeCounterOffer,
  toNegotiationCartLine,
} from './negotiation-offer-helpers';

const colors = {
  primary: '#111',
  muted: '#eee',
  primaryForeground: '#fff',
  text: '#000',
};

describe('buildSuccessButtonStyles', () => {
  it('uses the primary "apply" treatment for the primary style', () => {
    const { button, text } = buildSuccessButtonStyles('primary', colors);
    expect(button).toContainEqual({ backgroundColor: colors.primary });
    expect(text).toContainEqual({ color: colors.primaryForeground });
  });

  it('uses the neutral "done" treatment otherwise', () => {
    const { button, text } = buildSuccessButtonStyles('neutral', colors);
    expect(button).toContainEqual({ backgroundColor: colors.muted });
    expect(text).toContainEqual({ color: colors.text });
  });
});

describe('toNegotiationCartLine', () => {
  it('maps a mobile cart item into the snapshot shape', () => {
    const line = toNegotiationCartLine({
      id: 'line-1',
      name: 'iPhone 15 Pro',
      price: 1_200_000,
      product_id: 'product-1',
      quantity: 2,
      slug: 'iphone-15-pro',
      image_url: 'https://cdn.example/iphone.png',
      variant_id: 'v1',
      variant_name: '256GB',
      brand: 'Apple',
      condition: 'new',
    } as Parameters<typeof toNegotiationCartLine>[0]);

    expect(line).toEqual({
      product_id: 'product-1',
      name: 'iPhone 15 Pro',
      price: 1_200_000,
      quantity: 2,
      image: 'https://cdn.example/iphone.png',
      variant_id: 'v1',
      variant_name: '256GB',
      brand: 'Apple',
      condition: 'new',
    });
  });

  it('uses negotiated prices and keeps quiz vouchers zero-priced', () => {
    expect(
      toNegotiationCartLine({
        id: 'line-1',
        name: 'iPhone 15 Pro',
        price: 1_200_000,
        negotiatedPrice: 1_100_000,
        product_id: 'product-1',
        quantity: 1,
        slug: 'iphone-15-pro',
      } as Parameters<typeof toNegotiationCartLine>[0]).price
    ).toBe(1_100_000);

    expect(
      toNegotiationCartLine({
        id: 'gift-1',
        name: 'Quiz Gift',
        price: 205_000,
        product_id: 'product-2',
        quantity: 1,
        slug: 'quiz-gift',
        voucher_award_id: 'award-1',
        voucher_token: 'signed-token',
      } as Parameters<typeof toNegotiationCartLine>[0]).price
    ).toBe(0);
  });
});

describe('computeCounterOffer', () => {
  it('uses the playful copy and shallowest discount on the first attempt', () => {
    const { proposedCounter, replyMessage } = computeCounterOffer(0, 100_000);
    expect(replyMessage).toBe("That's a bit low. But I can do:");
    expect(proposedCounter).toBeLessThan(100_000);
  });

  it('escalates copy and deepens the discount on later attempts', () => {
    const first = computeCounterOffer(0, 100_000);
    const second = computeCounterOffer(1, 100_000);

    expect(second.replyMessage).toBe(
      "We're getting closer. The best I can do is:"
    );
    // Deeper discount → a lower counter price than the first attempt.
    expect(second.proposedCounter).toBeLessThanOrEqual(first.proposedCounter);
  });

  it('caps at the final-offer copy beyond the configured steps', () => {
    const { replyMessage } = computeCounterOffer(99, 100_000);
    expect(replyMessage).toBe('This is my absolute final offer:');
  });
});
