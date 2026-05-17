import { describe, expect, it } from 'vitest';
import {
  ucpCheckoutCompleteRequestSchema,
  ucpCheckoutCreateRequestSchema,
  ucpCheckoutUpdateRequestSchema,
} from '@/schemas/ucp-checkout-request';

describe('ucpCheckoutCreateRequestSchema', () => {
  it('accepts UCP checkout line items and normalizes currency', () => {
    const parsed = ucpCheckoutCreateRequestSchema.parse({
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
        street_address: '12 Broad Street',
      },
    });

    expect(parsed).toMatchObject({
      currency: 'NGN',
      line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
      shipping_address: {
        address_country: 'NG',
        address_locality: 'Lagos',
        street_address: '12 Broad Street',
      },
    });
  });

  it('rejects missing UCP line items', () => {
    const parsed = ucpCheckoutCreateRequestSchema.safeParse({});

    expect(parsed.success).toBe(false);
  });

  it('rejects non-letter currency codes', () => {
    const parsed = ucpCheckoutCreateRequestSchema.safeParse({
      currency: 'n1n',
      line_items: [
        {
          item: { id: 'product-1' },
          quantity: 1,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe('ucpCheckoutCompleteRequestSchema', () => {
  it('accepts UCP payment instruments for checkout completion', () => {
    const parsed = ucpCheckoutCompleteRequestSchema.parse({
      payment: {
        instruments: [
          {
            billing_address: {
              address_country: 'NG',
              address_locality: 'Lagos',
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

    expect(parsed).toMatchObject({
      payment: {
        instruments: [
          {
            handler_id: 'paystack_bank_transfer',
            id: 'instrument_1',
            type: 'paystack_bank_transfer',
          },
        ],
      },
    });
  });

  it('rejects complete requests without a selected payment instrument candidate', () => {
    const parsed = ucpCheckoutCompleteRequestSchema.safeParse({
      payment: {
        instruments: [],
      },
    });

    expect(parsed.success).toBe(false);
  });

  it.each([
    ['missing payment', {}],
    ['missing instruments', { payment: {} }],
    ['non-array instruments', { payment: { instruments: 'instrument_1' } }],
    [
      'invalid billing address field type',
      {
        payment: {
          instruments: [
            {
              billing_address: { street_address: 123 },
              handler_id: 'paystack_bank_transfer',
              id: 'instrument_1',
              type: 'paystack_bank_transfer',
            },
          ],
        },
      },
    ],
    [
      'billing address with unknown fields only',
      {
        payment: {
          instruments: [
            {
              billing_address: { addressCountry: 'NG' },
              handler_id: 'paystack_bank_transfer',
              id: 'instrument_1',
              type: 'paystack_bank_transfer',
            },
          ],
        },
      },
    ],
    [
      'empty billing address object',
      {
        payment: {
          instruments: [
            {
              billing_address: {},
              handler_id: 'paystack_bank_transfer',
              id: 'instrument_1',
              type: 'paystack_bank_transfer',
            },
          ],
        },
      },
    ],
    [
      'blank handler id',
      {
        payment: {
          instruments: [
            {
              handler_id: '   ',
              id: 'instrument_1',
              type: 'paystack_bank_transfer',
            },
          ],
        },
      },
    ],
    [
      'blank type',
      {
        payment: {
          instruments: [
            {
              handler_id: 'paystack_bank_transfer',
              id: 'instrument_1',
              type: '   ',
            },
          ],
        },
      },
    ],
    [
      'multiple selected instruments',
      {
        payment: {
          instruments: [
            {
              handler_id: 'paystack_bank_transfer',
              id: 'instrument_1',
              selected: true,
              type: 'paystack_bank_transfer',
            },
            {
              handler_id: 'paystack_bank_transfer',
              id: 'instrument_2',
              selected: true,
              type: 'paystack_bank_transfer',
            },
          ],
        },
      },
    ],
  ])('rejects invalid complete request bodies: %s', (_name, body) => {
    const parsed = ucpCheckoutCompleteRequestSchema.safeParse(body);

    expect(parsed.success).toBe(false);
  });
});

describe('ucpCheckoutUpdateRequestSchema', () => {
  it('accepts replacement line items and explicit address clearing', () => {
    const parsed = ucpCheckoutUpdateRequestSchema.parse({
      line_items: [
        {
          item: { id: 'product-2', price: 250_000, title: 'Case' },
          quantity: 1,
        },
      ],
      shipping_address: null,
    });

    expect(parsed).toMatchObject({
      line_items: [{ item: { id: 'product-2' }, quantity: 1 }],
      shipping_address: null,
    });
  });

  it('accepts UCP postal shipping addresses', () => {
    const parsed = ucpCheckoutUpdateRequestSchema.parse({
      line_items: [
        {
          item: { id: 'product-2', price: 250_000, title: 'Case' },
          quantity: 1,
        },
      ],
      shipping_address: {
        address_country: 'NG',
        address_locality: 'Lagos',
        street_address: '12 Broad Street',
      },
    });

    expect(parsed).toMatchObject({
      shipping_address: {
        address_country: 'NG',
        address_locality: 'Lagos',
        street_address: '12 Broad Street',
      },
    });
  });

  it('rejects updates without replacement line items', () => {
    const parsed = ucpCheckoutUpdateRequestSchema.safeParse({
      shipping_address: { city: 'Lagos' },
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects shipping addresses with unknown fields only', () => {
    const parsed = ucpCheckoutUpdateRequestSchema.safeParse({
      line_items: [
        {
          item: { id: 'product-2', price: 250_000, title: 'Case' },
          quantity: 1,
        },
      ],
      shipping_address: { addressCountry: 'NG' },
    });

    expect(parsed.success).toBe(false);
  });
});
