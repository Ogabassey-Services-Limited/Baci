import {
  isPaymentCancellationRedirect,
  isPaymentCompletionRedirect,
  isPaymentGatewayRecord,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_KINDS,
} from './payment-gateway.helpers';

describe('payment-gateway.helpers', () => {
  it('narrows plain records without accepting arrays or nullish values', () => {
    expect(isPaymentGatewayRecord({ type: 'payment_clipboard_copy' })).toBe(
      true
    );
    expect(isPaymentGatewayRecord([])).toBe(false);
    expect(isPaymentGatewayRecord(null)).toBe(false);
  });

  it('exposes stable labels and payment kind constants', () => {
    expect(PAYMENT_GATEWAY_LABELS.paystack).toBe('Paystack');
    expect(PAYMENT_KINDS.VTU).toBe('vtu');
    expect(PAYMENT_KINDS.ORDER).toBe('order');
  });

  it('detects payment completion redirects', () => {
    expect(
      isPaymentCompletionRedirect('https://usebaci.com/checkout/success')
    ).toBe(true);
    expect(
      isPaymentCompletionRedirect('https://usebaci.com/orders?trxref=ref-123')
    ).toBe(true);
    expect(isPaymentCompletionRedirect('not-a-url')).toBe(false);
  });

  it('detects explicit cancellation redirects only', () => {
    expect(
      isPaymentCancellationRedirect(
        'https://checkout.example.com/pay?cancelled=true'
      )
    ).toBe(true);
    expect(
      isPaymentCancellationRedirect('https://checkout.example.com/cancel')
    ).toBe(true);
    expect(
      isPaymentCancellationRedirect(
        'https://checkout.example.com/cancelled-order'
      )
    ).toBe(false);
  });
});
