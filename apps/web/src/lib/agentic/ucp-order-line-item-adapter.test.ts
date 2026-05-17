import { describe, expect, it } from 'vitest';
import { mapUcpOrderLineItem } from '@/lib/agentic/ucp-order-line-item-adapter';

describe('mapUcpOrderLineItem', () => {
  it('derives partial fulfillment from item fulfillment data', () => {
    const lineItem = mapUcpOrderLineItem(
      {
        fulfillment_data: { fulfilled_quantity: 1 },
        id: 'item_1',
        name: 'Phone',
        price: 150_000,
        quantity: 2,
      },
      0,
      'processing'
    );

    expect(lineItem).toMatchObject({
      quantity: { fulfilled: 1, total: 2 },
      status: 'partial',
    });
  });

  it('marks line items fulfilled when the order is delivered', () => {
    const lineItem = mapUcpOrderLineItem(
      {
        id: 'item_1',
        name: 'Phone',
        price: 150_000,
        quantity: 2,
      },
      0,
      'delivered'
    );

    expect(lineItem).toMatchObject({
      quantity: { fulfilled: 2, total: 2 },
      status: 'fulfilled',
    });
  });

  it('normalizes line-item price to unit amount when line totals are provided', () => {
    const lineItem = mapUcpOrderLineItem(
      {
        id: 'item_1',
        line_extension_amount: 300_000,
        name: 'Phone',
        price: 300_000,
        quantity: 2,
      },
      0,
      'processing'
    );

    expect(lineItem.item.price).toBe(150_000);
    expect(lineItem.totals).toEqual([
      { amount: 300_000, display_text: 'Total', type: 'total' },
    ]);
  });

  it('falls back safely for malformed line-item payloads', () => {
    const lineItem = mapUcpOrderLineItem(null, 0, null);

    expect(lineItem).toMatchObject({
      id: 'line_1',
      item: {
        id: 'line_1',
        price: 0,
        title: 'Unknown item',
      },
      quantity: { fulfilled: 0, total: 1 },
      status: 'processing',
    });
  });
});
