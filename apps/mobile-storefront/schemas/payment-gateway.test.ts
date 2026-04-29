import { describe, expect, it } from '@jest/globals';
import { PaymentGatewayParamsSchema } from './payment-gateway';

describe('PaymentGatewayParamsSchema', () => {
  it('parses a VTU checkout payload with defaults', () => {
    const result = PaymentGatewayParamsSchema.parse({
      authorizationUrl: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      reference: 'ref-123',
    });

    expect(result.paymentKind).toBe('order');
  });

  it('rejects invalid gateway params', () => {
    const result = PaymentGatewayParamsSchema.safeParse({
      authorizationUrl: 'not-a-url',
      gateway: 'invalid',
      reference: '',
    });

    expect(result.success).toBe(false);
  });
});
