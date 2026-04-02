import {
  BACI_GOOGLE_REVIEW_URL,
  canLeaveStorefrontGoogleReview,
  canRequestStorefrontOrderReturn,
  canShowStorefrontRiderContact,
  isStorefrontReceiptAvailable,
} from './post-purchase-actions';

describe('post-purchase-actions', () => {
  it('exposes the storefront Google review link', () => {
    expect(BACI_GOOGLE_REVIEW_URL).toBe(
      'https://g.page/r/CR1gsFYL8eu9EBM/review'
    );
  });

  it('only marks paid shipped or delivered orders as receipt-ready', () => {
    expect(
      isStorefrontReceiptAvailable({
        paymentStatus: 'paid',
        shippingStatus: 'shipped',
      })
    ).toBe(true);
    expect(
      isStorefrontReceiptAvailable({
        paymentStatus: 'paid',
        shippingStatus: 'delivered',
      })
    ).toBe(true);
    expect(
      isStorefrontReceiptAvailable({
        paymentStatus: 'pending',
        shippingStatus: 'shipped',
      })
    ).toBe(false);
    expect(
      isStorefrontReceiptAvailable({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
      })
    ).toBe(false);
  });

  it('shows rider contact only while the order is actively en route', () => {
    expect(canShowStorefrontRiderContact('shipped')).toBe(true);
    expect(canShowStorefrontRiderContact('out_for_delivery')).toBe(true);
    expect(canShowStorefrontRiderContact('delivered')).toBe(false);
    expect(canShowStorefrontRiderContact('pending')).toBe(false);
  });

  it('only enables review and return actions after delivery', () => {
    expect(canLeaveStorefrontGoogleReview('delivered')).toBe(true);
    expect(canRequestStorefrontOrderReturn('delivered')).toBe(true);
    expect(canLeaveStorefrontGoogleReview('shipped')).toBe(false);
    expect(canRequestStorefrontOrderReturn('shipped')).toBe(false);
  });
});
