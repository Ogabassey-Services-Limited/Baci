import { describe, expect, it } from 'vitest';
import {
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
      shipping_address: { city: 'Lagos' },
    });

    expect(adapted).toEqual({
      currency: 'NGN',
      items: [{ id: 'product-1', quantity: 2 }],
      shipping_address: { city: 'Lagos' },
    });
  });

  it('preserves legacy checkout bodies unchanged', () => {
    const body = { items: [{ id: 'product-1', quantity: 1 }] };

    expect(adaptUcpCheckoutCreateRequestBody(body)).toBe(body);
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
