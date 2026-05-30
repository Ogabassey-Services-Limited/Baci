import {
  ConfirmCheckoutResponseSchema,
  InitCheckoutResponseSchema,
} from './vtu-checkout-response-schemas';

describe('vtu checkout response schemas', () => {
  it('parses initialize checkout success responses', () => {
    expect(
      InitCheckoutResponseSchema.parse({
        success: true,
        authorization_url: 'https://paystack.com/pay/abc',
        gateway: 'paystack',
        reference: 'VTU-123',
        vtu_reference: 'REQ-123',
        vtu_transaction_id: 'vtu-1',
      })
    ).toMatchObject({ reference: 'VTU-123' });
  });

  it('rejects unsupported confirmation statuses', () => {
    expect(() =>
      ConfirmCheckoutResponseSchema.parse({
        status: 'failed',
        reference: 'VTU-123',
      })
    ).toThrow();
  });
});
