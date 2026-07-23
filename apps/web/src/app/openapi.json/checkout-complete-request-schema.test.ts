import { describe, expect, it } from 'vitest';
import { buildCheckoutCompleteRequestSchema } from './checkout-complete-request-schema';

describe('buildCheckoutCompleteRequestSchema', () => {
  it('omits Paystack DVA providers and token requirements while paused', () => {
    const paused = true;

    const schema = buildCheckoutCompleteRequestSchema(paused);

    expect(schema.properties.payment_data.properties.provider.enum).toEqual([
      'pay_on_delivery',
    ]);
    expect(schema.properties.payment_data.required).toEqual(['provider']);
  });

  it('preserves the enabled Paystack bank-transfer contract', () => {
    const paused = false;

    const schema = buildCheckoutCompleteRequestSchema(paused);

    expect(schema.properties.payment_data.properties.provider.enum).toEqual([
      'paystack',
      'paystack_bank_transfer',
    ]);
    expect(schema.properties.payment_data.required).toEqual([
      'provider',
      'token',
    ]);
  });

  it('preserves non-payment schema fields in both DVA modes', () => {
    const modes = [true, false];

    for (const paused of modes) {
      const schema = buildCheckoutCompleteRequestSchema(paused);

      expect(schema.properties.buyer).toEqual({
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone_number: { type: 'string' },
        },
        required: ['email', 'first_name', 'last_name', 'phone_number'],
      });
      expect(schema.properties.payment_data.properties.billing_address).toEqual(
        {
          type: 'object',
          additionalProperties: true,
        }
      );
      expect(schema.properties.completion_authorization).toEqual({
        type: ['object', 'null'],
        additionalProperties: true,
      });
    }
  });
});
