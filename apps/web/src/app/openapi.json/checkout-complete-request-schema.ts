export function buildCheckoutCompleteRequestSchema(paystackDvaPaused: boolean) {
  return {
    type: 'object',
    properties: {
      buyer: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone_number: { type: 'string' },
        },
        required: ['email', 'first_name', 'last_name', 'phone_number'],
      },
      payment_data: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: paystackDvaPaused
              ? ['pay_on_delivery']
              : ['paystack', 'paystack_bank_transfer'],
          },
          token: { type: 'string' },
          billing_address: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: paystackDvaPaused ? ['provider'] : ['provider', 'token'],
      },
      completion_authorization: {
        type: ['object', 'null'],
        additionalProperties: true,
      },
    },
    required: ['buyer', 'payment_data'],
  };
}
