import { describe, expect, it } from 'vitest';
import {
  adaptUcpCheckoutCompleteRequestBody,
  adaptUcpCheckoutCreateRequestBody,
  adaptUcpCheckoutUpdateRequestBody,
} from '@/lib/agentic/ucp-request-adapters';

describe('adaptUcpCheckoutCreateRequestBody', () => {
  it('translates UCP line_items into legacy checkout items', () => {
    const adapted = adaptUcpCheckoutCreateRequestBody({
      currency: 'ngn',
      line_items: [
        {
          item: { id: 'product-1', price: 500_000, title: 'Phone' },
          quantity: 2,
        },
      ],
      shipping_address: {
        address_country: 'NG',
        address_locality: 'Lagos',
        address_region: 'Lagos',
        street_address: '12 Broad Street',
      },
    });

    expect(adapted).toEqual({
      currency: 'NGN',
      items: [{ id: 'product-1', quantity: 2 }],
      shipping_address: {
        address: '12 Broad Street',
        city: 'Lagos',
        country: 'NG',
        country_code: 'NG',
        state: 'Lagos',
      },
    });
  });

  it('preserves legacy checkout bodies unchanged', () => {
    const body = { items: [{ id: 'product-1', quantity: 1 }] };

    expect(adaptUcpCheckoutCreateRequestBody(body)).toBe(body);
  });
});

describe('adaptUcpCheckoutCompleteRequestBody', () => {
  it('translates selected UCP Paystack payment instruments into legacy complete bodies', () => {
    const adapted = adaptUcpCheckoutCompleteRequestBody({
      completion_authorization: null,
      payment: {
        instruments: [
          {
            billing_address: {
              address_country: 'NG',
              address_locality: 'Lagos',
              address_region: 'Lagos',
              email: 'buyer@example.com',
              first_name: 'Buyer',
              last_name: 'One',
              phone_number: '08012345678',
              street_address: '12 Broad Street',
            },
            credential: { token: 'instrument-token', type: 'token' },
            handler_id: 'paystack_bank_transfer',
            id: 'instrument_1',
            selected: true,
            type: 'paystack_bank_transfer',
          },
        ],
      },
    });

    expect(adapted).toEqual({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Buyer',
        last_name: 'One',
        phone_number: '08012345678',
      },
      completion_authorization: null,
      payment_data: {
        billing_address: expect.objectContaining({
          address: '12 Broad Street',
          city: 'Lagos',
          country: 'NG',
          country_code: 'NG',
          email: 'buyer@example.com',
          name: 'Buyer One',
          phone: '08012345678',
          state: 'Lagos',
        }),
        provider: 'paystack',
        token: 'instrument-token',
      },
    });
  });

  it('translates UCP pay-on-delivery instruments without requiring a token', () => {
    const adapted = adaptUcpCheckoutCompleteRequestBody({
      payment: {
        instruments: [
          {
            billing_address: {
              email: 'buyer@example.com',
              first_name: 'Buyer',
              last_name: 'Two',
              phone_number: '08012345678',
            },
            handler_id: 'pay_on_delivery',
            id: 'instrument_2',
            type: 'pay_on_delivery',
          },
        ],
      },
    });

    expect(adapted).toEqual({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Buyer',
        last_name: 'Two',
        phone_number: '08012345678',
      },
      payment_data: {
        billing_address: expect.objectContaining({
          email: 'buyer@example.com',
          name: 'Buyer Two',
          phone: '08012345678',
        }),
        provider: 'pay_on_delivery',
      },
    });
  });

  it('returns the original body when buyer contact fields cannot be derived', () => {
    const body = {
      payment: {
        instruments: [
          {
            billing_address: {
              first_name: 'Buyer',
              last_name: 'One',
              phone_number: '08012345678',
            },
            credential: { token: 'instrument-token', type: 'token' },
            handler_id: 'paystack_bank_transfer',
            id: 'instrument_1',
            type: 'paystack_bank_transfer',
          },
        ],
      },
    };

    expect(adaptUcpCheckoutCompleteRequestBody(body)).toBe(body);
  });

  it.each([
    ['credential id', { id: 'credential-id', type: 'token' }, 'credential-id'],
    [
      'credential reference',
      { reference: 'credential-reference', type: 'token' },
      'credential-reference',
    ],
  ])('uses %s as a Paystack token fallback', (_name, credential, token) => {
    const adapted = adaptUcpCheckoutCompleteRequestBody({
      payment: {
        instruments: [
          {
            billing_address: {
              email: 'buyer@example.com',
              first_name: 'Buyer',
              last_name: 'Fallback',
              phone_number: '08012345678',
            },
            credential,
            handler_id: 'paystack_bank_transfer',
            id: 'instrument_1',
            type: 'paystack_bank_transfer',
          },
        ],
      },
    });

    expect(adapted).toMatchObject({
      payment_data: { provider: 'paystack', token },
    });
  });

  it('does not use the instrument id as a Paystack token fallback', () => {
    const body = {
      payment: {
        instruments: [
          {
            billing_address: {
              email: 'buyer@example.com',
              first_name: 'Buyer',
              last_name: 'MissingToken',
              phone_number: '08012345678',
            },
            credential: { type: 'token' },
            handler_id: 'paystack_bank_transfer',
            id: 'instrument_id_is_not_a_token',
            type: 'paystack_bank_transfer',
          },
        ],
      },
    };

    expect(adaptUcpCheckoutCompleteRequestBody(body)).toBe(body);
  });

  it('derives buyer names from a full billing name when split names are absent', () => {
    const adapted = adaptUcpCheckoutCompleteRequestBody({
      payment: {
        instruments: [
          {
            billing_address: {
              email: 'buyer@example.com',
              name: 'Buyer Four',
              phone_number: '08012345678',
            },
            handler_id: 'pay_on_delivery',
            id: 'instrument_4',
            type: 'pay_on_delivery',
          },
        ],
      },
    });

    expect(adapted).toMatchObject({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Buyer',
        last_name: 'Four',
        phone_number: '08012345678',
      },
      payment_data: {
        billing_address: expect.objectContaining({ name: 'Buyer Four' }),
      },
    });
  });

  it('returns empty billing address objects unchanged for legacy validation', () => {
    const body = {
      payment: {
        instruments: [
          {
            billing_address: {},
            handler_id: 'pay_on_delivery',
            id: 'instrument_5',
            type: 'pay_on_delivery',
          },
        ],
      },
    };

    expect(adaptUcpCheckoutCompleteRequestBody(body)).toBe(body);
  });

  it('preserves legacy complete bodies unchanged', () => {
    const body = {
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Buyer',
        last_name: 'One',
        phone_number: '08012345678',
      },
      payment_data: {
        provider: 'pay_on_delivery',
      },
    };

    expect(adaptUcpCheckoutCompleteRequestBody(body)).toBe(body);
  });

  it('returns unsupported UCP payment handlers unchanged so legacy validation rejects them', () => {
    const body = {
      payment: {
        instruments: [
          {
            billing_address: {
              email: 'buyer@example.com',
              first_name: 'Buyer',
              last_name: 'Three',
              phone_number: '08012345678',
            },
            handler_id: 'unsupported_handler',
            id: 'instrument_3',
            type: 'unsupported',
          },
        ],
      },
    };

    expect(adaptUcpCheckoutCompleteRequestBody(body)).toBe(body);
  });
});

describe('adaptUcpCheckoutUpdateRequestBody', () => {
  it('uses provided UCP fields as replacement values', () => {
    const adapted = adaptUcpCheckoutUpdateRequestBody({
      line_items: [
        {
          item: { id: 'product-2', price: 250_000, title: 'Case' },
          quantity: 1,
        },
      ],
      shipping_address: null,
    });

    expect(adapted).toEqual({
      fulfillment_option_id: null,
      items: [{ id: 'product-2', quantity: 1 }],
      shipping_address: null,
    });
  });

  it('normalizes UCP postal shipping addresses for checkout updates', () => {
    const adapted = adaptUcpCheckoutUpdateRequestBody({
      line_items: [
        {
          item: { id: 'product-2', price: 250_000, title: 'Case' },
          quantity: 1,
        },
      ],
      shipping_address: {
        address_country: 'NG',
        address_locality: 'Lagos',
        address_region: 'Lagos',
        street_address: '12 Broad Street',
      },
    });

    expect(adapted).toMatchObject({
      fulfillment_option_id: null,
      shipping_address: {
        address: '12 Broad Street',
        city: 'Lagos',
        country: 'NG',
        country_code: 'NG',
        state: 'Lagos',
      },
    });
  });

  it('maps fulfillment selection from UCP fulfillment methods', () => {
    const adapted = adaptUcpCheckoutUpdateRequestBody({
      fulfillment: {
        methods: [
          {
            groups: [{ selected_option_id: 'shipping_option_express' }],
          },
        ],
      },
      line_items: [
        {
          item: { id: 'product-2', price: 250_000, title: 'Case' },
          quantity: 1,
        },
      ],
      shipping_address: null,
    });

    expect(adapted).toMatchObject({
      fulfillment_option_id: 'shipping_option_express',
      items: [{ id: 'product-2', quantity: 1 }],
      shipping_address: null,
    });
  });

  it('leaves legacy item update bodies unchanged', () => {
    const body = { items: [{ id: 'product-1', quantity: 1 }] };

    expect(adaptUcpCheckoutUpdateRequestBody(body)).toBe(body);
  });

  it('returns malformed UCP updates unchanged so legacy validation rejects them', () => {
    const body = {
      shipping_address: { city: 'Lagos' },
    };

    expect(adaptUcpCheckoutUpdateRequestBody(body)).toBe(body);
  });
});
