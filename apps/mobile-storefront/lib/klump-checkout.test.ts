import type { WalletSelection } from '@/components/checkout/PaymentMethodSelector';
import {
  buildKlumpBnplRouteParams,
  buildKlumpInitializePayload,
  getKlumpDisabledReason,
} from './klump-checkout';

const settings = {
  klump_enabled: true,
  klump_max_amount: 500000,
  klump_min_amount: 10000,
};

describe('klump checkout helpers', () => {
  it('does not disable eligible Klump orders', () => {
    expect(getKlumpDisabledReason(settings, 120000)).toBeUndefined();
  });

  it('disables Klump when wallet credit is active', () => {
    const walletSelection: WalletSelection = { use: true, amount: 5000 };

    expect(getKlumpDisabledReason(settings, 120000, walletSelection)).toBe(
      'Wallet credit cannot be combined with Klump'
    );
  });

  it('uses merchant configured amount boundaries for disabled reasons', () => {
    expect(getKlumpDisabledReason(settings, 9000)).toBe(
      'Minimum order: ₦10,000'
    );
    expect(getKlumpDisabledReason(settings, 600000)).toBe(
      'Maximum order: ₦500,000'
    );
  });

  it('builds the initialize payload from the full order total', () => {
    expect(
      buildKlumpInitializePayload({
        customerEmail: 'customer@example.com',
        customerName: 'Ada Customer',
        customerPhone: '08012345678',
        merchantId: 'merchant-123',
        orderId: 'order-123',
        orderTotal: 120000,
      })
    ).toEqual({
      amount: 120000,
      currency: 'NGN',
      customer_email: 'customer@example.com',
      customer_name: 'Ada Customer',
      customer_phone: '08012345678',
      gateway: 'klump',
      merchant_id: 'merchant-123',
      order_id: 'order-123',
    });
  });

  it('builds BNPL route params with authorization URL, reference, and tracking token', () => {
    expect(
      buildKlumpBnplRouteParams({
        amount: 120000,
        authorizationUrl:
          'https://ogabassey.usebaci.com/checkout/bnpl?gateway=klump',
        customerEmail: 'customer@example.com',
        customerName: 'Ada Customer',
        customerPhone: '08012345678',
        orderId: 'order-123',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'track-token-123',
      })
    ).toEqual({
      amount: '120000',
      authorizationUrl:
        'https://ogabassey.usebaci.com/checkout/bnpl?gateway=klump',
      customerEmail: 'customer@example.com',
      customerName: 'Ada Customer',
      customerPhone: '08012345678',
      gateway: 'klump',
      orderId: 'order-123',
      reference: 'BAC-ABCD12345678',
      trackingToken: 'track-token-123',
    });
  });
});
