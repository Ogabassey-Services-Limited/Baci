import { describe, expect, it } from 'vitest';
import { normalizeBumpaOrderRow } from './normalize-bumpa-order-row';

interface AliasCase {
  name: string;
  input: Record<string, string>;
  expected: Record<string, string>;
}

describe('normalizeBumpaOrderRow', () => {
  it('maps raw snake_case Bumpa rich export fields to canonical order headers', () => {
    const itemsJson = JSON.stringify([
      {
        name: 'New 2025 Apple iPad M3 256gb WiFi + Cellular ',
        quantity: 1,
        description: 'IMEI: 359200573024554 <do not strip>',
      },
      {
        name: 'Samsung UHD 4K TV ',
        quantity: 2,
      },
    ]);
    const row = normalizeBumpaOrderRow({
      id: '3253798',
      order_number: '06074',
      customer_first_name: 'Bassey',
      customer_last_name: 'John',
      customer_email: 'basseybjohn@example.com',
      customer_phone: '+2349169449282',
      payment_status: 'PAID',
      status: 'COMPLETED',
      shipping_status: 'DELIVERED',
      total: '1586000.00',
      sub_total: '1585000.00',
      amount_paid: '1586000.00',
      amount_due: '0.00',
      order_date: '2025-11-06 00:00:00',
      created_at: '2025-11-06T18:27:18.000000Z',
      updated_at: '2025-11-06T18:57:20.000000Z',
      shipping_option_name: 'Store delivery',
      items_json: itemsJson,
    });

    expect(row).toMatchObject({
      id: '3253798',
      'Order Number': '06074',
      Products:
        'New 2025 Apple iPad M3 256gb WiFi + Cellular | Samsung UHD 4K TV',
      'Product Quantity': '1 | 2',
      'Customer Name': 'Bassey John',
      'Customer Email': 'basseybjohn@example.com',
      'Customer Phone': '+2349169449282',
      'Payment Status': 'PAID',
      Status: 'COMPLETED',
      'Shipping Status': 'DELIVERED',
      Total: '1586000.00',
      'Sub Total': '1585000.00',
      'Amount Paid': '1586000.00',
      'Amount Due': '0.00',
      'Order Date': '2025-11-06 00:00:00',
      'Created At': '2025-11-06T18:27:18.000000Z',
      'Updated At': '2025-11-06T18:57:20.000000Z',
      'Shipping Option': 'Store delivery',
    });

    expect(row.items_json).toBe(itemsJson);
    expect(JSON.parse(row.items_json)).toEqual([
      {
        name: 'New 2025 Apple iPad M3 256gb WiFi + Cellular ',
        quantity: 1,
        description: 'IMEI: 359200573024554 <do not strip>',
      },
      {
        name: 'Samsung UHD 4K TV ',
        quantity: 2,
      },
    ]);
  });

  it('keeps titled Bumpa CSV headers ahead of snake_case aliases', () => {
    const row = normalizeBumpaOrderRow({
      'Order Number': 'titled-order',
      order_number: 'raw-order',
      Products: 'Titled Product',
      items_names: 'Raw Product',
      'Customer Name': 'Titled Customer',
      customer_first_name: 'Raw',
      customer_last_name: 'Customer',
    });

    expect(row['Order Number']).toBe('titled-order');
    expect(row.Products).toBe('Titled Product');
    expect(row['Customer Name']).toBe('Titled Customer');
  });

  const aliasCases: AliasCase[] = [
    {
      name: 'items_names',
      input: { items_names: 'Items Alias Product' },
      expected: { Products: 'Items Alias Product' },
    },
    {
      name: 'product_names',
      input: { product_names: 'Product Names Alias' },
      expected: { Products: 'Product Names Alias' },
    },
    {
      name: 'shipping customer fields',
      input: {
        shipping_first_name: 'Grace',
        shipping_last_name: 'Hopper',
        shipping_email: 'grace@example.com',
        shipping_phone: '08012345678',
      },
      expected: {
        'Customer Name': 'Grace Hopper',
        'Customer Email': 'grace@example.com',
        'Customer Phone': '08012345678',
      },
    },
    {
      name: 'product_sku',
      input: { product_sku: 'SKU-1' },
      expected: { 'Product SKU': 'SKU-1' },
    },
    {
      name: 'product_skus',
      input: { product_skus: 'SKU-1 | SKU-2' },
      expected: { 'Product SKU': 'SKU-1 | SKU-2' },
    },
    {
      name: 'shipping_option_description',
      input: { shipping_option_description: 'Same-day delivery' },
      expected: { 'Shipping Option': 'Same-day delivery' },
    },
  ];

  it.each(aliasCases)('maps $name aliases', ({ input, expected }) => {
    expect(normalizeBumpaOrderRow(input)).toMatchObject(expected);
  });

  it('falls back safely when items_json is malformed', () => {
    const row = normalizeBumpaOrderRow({
      id: '3253798',
      order_number: '06074',
      customer_first_name: 'Bassey',
      customer_last_name: 'John',
      items_json: '{not-valid-json',
    });

    expect(row['Order Number']).toBe('06074');
    expect(row['Customer Name']).toBe('Bassey John');
    expect(row.Products).toBe('');
    expect(row['Product Quantity']).toBe('');
    expect(row.items_json).toBe('{not-valid-json');
  });
});
