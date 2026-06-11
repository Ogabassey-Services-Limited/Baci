import { describe, expect, it } from 'vitest';
import {
  FetchGoogleSheetInputSchema,
  ParseCsvDirectlyInputSchema,
  ProcessPriceListInputSchema,
} from './dashboard-product-import-actions';

const currentProducts = [
  {
    id: 'product-1',
    name: 'Existing Phone',
    price: 1000,
    sku: 'SKU-1',
    stock: 3,
    internalSecret: 'must be stripped',
  },
];

describe('dashboard product import action schemas', () => {
  it('strips unrecognized product fields before model prompts are built', () => {
    const parsed = ProcessPriceListInputSchema.parse({
      currentProducts,
      priceListData: 'Name,Price\nNew Phone,2000',
      vendor: 'Vendor',
      fileType: ' text/csv ',
    });

    expect(parsed.fileType).toBe('text/csv');
    expect(parsed.currentProducts[0]).toEqual({
      id: 'product-1',
      name: 'Existing Phone',
      price: 1000,
      sku: 'SKU-1',
      stock: 3,
    });
    expect(JSON.stringify(parsed.currentProducts)).not.toContain(
      'internalSecret'
    );
  });

  it('rejects malformed MIME types and CSV files without name and price headers', () => {
    expect(
      ProcessPriceListInputSchema.safeParse({
        currentProducts,
        priceListData: 'Name,Price\nNew Phone,2000',
        vendor: 'Vendor',
        fileType: 'not-a-mime-type',
      }).success
    ).toBe(false);

    expect(
      ParseCsvDirectlyInputSchema.safeParse({
        currentProducts,
        csvData: 'SKU,Quantity\nOLD-1,5',
      }).success
    ).toBe(false);
  });

  it('validates Google Sheets URLs before fetch authorization work', () => {
    expect(
      FetchGoogleSheetInputSchema.safeParse({ url: 'not-a-url' }).success
    ).toBe(false);
  });
});
