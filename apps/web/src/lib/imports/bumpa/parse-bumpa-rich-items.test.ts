import { describe, expect, it } from 'vitest';
import { parseBumpaRichItems } from './parse-bumpa-rich-items';

describe('parseBumpaRichItems', () => {
  it('parses names, quantities, prices, totals, and fulfillment text', () => {
    expect(
      parseBumpaRichItems(
        JSON.stringify([
          {
            name: 'New 2025 Apple iPad M3 256gb WiFi + Cellular ',
            description: 'IMEI- 359200573024554\nSerial No.- J9CVYXYPQN',
            quantity: 1,
            price: 1350000,
            total: 1350000,
          },
          {
            name: 'Samsung UHD 4K TV ',
            note: 'Model code: UE50NU7020',
            quantity: '2.00',
            price: '235000.00',
            total: '470000.00',
          },
        ])
      )
    ).toEqual([
      {
        productName: 'New 2025 Apple iPad M3 256gb WiFi + Cellular',
        sku: null,
        quantity: 1,
        unitPrice: 1350000,
        lineTotal: 1350000,
        fulfillmentText: 'IMEI- 359200573024554 Serial No.- J9CVYXYPQN',
      },
      {
        productName: 'Samsung UHD 4K TV',
        sku: null,
        quantity: 2,
        unitPrice: 235000,
        lineTotal: 470000,
        fulfillmentText: 'Model code: UE50NU7020',
      },
    ]);
  });

  it('returns an empty array when items_json is malformed or not an array', () => {
    expect(parseBumpaRichItems('{not-valid-json')).toEqual([]);
    expect(
      parseBumpaRichItems(JSON.stringify({ name: 'Not an array' }))
    ).toEqual([]);
  });

  it('parses supported rich item aliases', () => {
    expect(
      parseBumpaRichItems(
        JSON.stringify([
          {
            product_name: 'Google Pixel 7a',
            product_sku: 'PIXEL-7A',
            qty: '2.00',
            unit_price: '300000.00',
            line_total: '600000.00',
          },
          {
            title: 'AirPods Pro',
            variant_sku: 'AIRPODS-PRO',
            quantity: 1,
            unitPrice: 250000,
            lineTotal: 250000,
          },
          {
            title: 'Delivery Add-on',
            amount: '5000.00',
          },
        ])
      )
    ).toEqual([
      expect.objectContaining({
        productName: 'Google Pixel 7a',
        sku: 'PIXEL-7A',
        quantity: 2,
        unitPrice: 300000,
        lineTotal: 600000,
      }),
      expect.objectContaining({
        productName: 'AirPods Pro',
        sku: 'AIRPODS-PRO',
        quantity: 1,
        unitPrice: 250000,
        lineTotal: 250000,
      }),
      expect.objectContaining({
        productName: 'Delivery Add-on',
        lineTotal: 5000,
      }),
    ]);
  });
});
