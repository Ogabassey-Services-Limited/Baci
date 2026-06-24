import { describe, expect, it } from 'vitest';
import {
  AIResponseSchema,
  BulkUpdateChangesSchema,
  FetchGoogleSheetInputSchema,
  MAX_GOOGLE_SHEET_URL_CHARS,
  MAX_PRICE_LIST_INPUT_CHARS,
  MAX_PRODUCTS_PER_IMPORT,
  ParseCsvDirectlyInputSchema,
  ProcessPriceListInputSchema,
} from './dashboard-product-import-actions';

const validProduct = {
  id: 'product-1',
  name: 'Existing Phone',
  price: 1000,
  cost_price: 700,
  sku: 'SKU-1',
  stock: 3,
};

const currentProducts = [
  {
    ...validProduct,
    internalSecret: 'must be stripped',
  },
];

function createProcessPriceListInput(overrides: Record<string, unknown> = {}) {
  return {
    currentProducts,
    priceListData: 'Name,Price\nNew Phone,2000',
    vendor: 'Vendor',
    fileType: 'text/csv',
    ...overrides,
  };
}

describe('dashboard product import action schemas', () => {
  it('parses a valid process-price-list payload and strips unrecognized product fields', () => {
    const parsed = ProcessPriceListInputSchema.parse(
      createProcessPriceListInput({ fileType: ' text/csv ' })
    );

    expect(parsed.fileType).toBe('text/csv');
    expect(parsed.currentProducts[0]).toEqual(validProduct);
    expect(JSON.stringify(parsed.currentProducts)).not.toContain(
      'internalSecret'
    );
  });

  it('normalizes legacy price-list file type labels from existing callers', () => {
    expect(
      ProcessPriceListInputSchema.parse(
        createProcessPriceListInput({
          vendor: 'Pasted text',
          fileType: 'text',
        })
      ).fileType
    ).toBe('text/plain');

    expect(
      ProcessPriceListInputSchema.parse(
        createProcessPriceListInput({
          vendor: 'Google Sheet Sync',
          fileType: 'csv',
        })
      ).fileType
    ).toBe('text/csv');
  });

  it('validates process-price-list file type boundaries', () => {
    const maxLengthMimeType = `a/${'b'.repeat(98)}`;
    const tooLongMimeType = `a/${'b'.repeat(99)}`;

    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({ fileType: maxLengthMimeType })
      ).success
    ).toBe(true);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({ fileType: tooLongMimeType })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({ fileType: 'not-a-mime-type' })
      ).success
    ).toBe(false);
  });

  it('validates process-price-list product count and payload size boundaries', () => {
    const tooManyProducts = Array.from(
      { length: MAX_PRODUCTS_PER_IMPORT + 1 },
      (_, index) => ({ ...validProduct, id: `product-${index}` })
    );

    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: Array.from(
            { length: MAX_PRODUCTS_PER_IMPORT },
            (_, index) => ({ ...validProduct, id: `valid-product-${index}` })
          ),
        })
      ).success
    ).toBe(true);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({ currentProducts: tooManyProducts })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          priceListData: 'x'.repeat(MAX_PRICE_LIST_INPUT_CHARS + 1),
        })
      ).success
    ).toBe(false);
  });

  it('validates product field limits and numeric guards', () => {
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, id: '' }],
        })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, name: 'x'.repeat(501) }],
        })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, sku: 'x'.repeat(257) }],
        })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, price: -1 }],
        })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [
            { ...validProduct, price: Number.POSITIVE_INFINITY },
          ],
        })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, stock: -1 }],
        })
      ).success
    ).toBe(false);
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, stock: Number.NaN }],
        })
      ).success
    ).toBe(false);
  });

  it('allows null and omitted import product cost prices', () => {
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, cost_price: null }],
        })
      ).success
    ).toBe(true);

    const { cost_price: _costPrice, ...productWithoutCostPrice } = validProduct;

    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [productWithoutCostPrice],
        })
      ).success
    ).toBe(true);
  });

  it('rejects invalid import product cost prices', () => {
    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, cost_price: -1 }],
        })
      ).success
    ).toBe(false);

    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [{ ...validProduct, cost_price: Number.NaN }],
        })
      ).success
    ).toBe(false);

    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [
            { ...validProduct, cost_price: Number.POSITIVE_INFINITY },
          ],
        })
      ).success
    ).toBe(false);

    expect(
      ProcessPriceListInputSchema.safeParse(
        createProcessPriceListInput({
          currentProducts: [
            { ...validProduct, cost_price: Number.NEGATIVE_INFINITY },
          ],
        })
      ).success
    ).toBe(false);
  });

  it('accepts zero and decimal import product cost prices', () => {
    for (const costPrice of [0, 10.5]) {
      expect(
        ProcessPriceListInputSchema.safeParse(
          createProcessPriceListInput({
            currentProducts: [{ ...validProduct, cost_price: costPrice }],
          })
        ).success
      ).toBe(true);
    }
  });

  it('allows null and omitted bulk change cost prices', () => {
    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: 'New Phone',
              price: 1000,
              cost_price: null,
            },
          },
        ],
      }).success
    ).toBe(true);

    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: 'New Phone',
              price: 1000,
            },
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects invalid selling prices and update prices at bulk boundaries', () => {
    for (const price of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        BulkUpdateChangesSchema.safeParse({
          changes: [
            {
              type: 'new',
              details: {
                name: 'New Phone',
                price,
              },
            },
          ],
        }).success
      ).toBe(false);

      expect(
        BulkUpdateChangesSchema.safeParse({
          changes: [
            {
              type: 'update',
              newPrice: price,
              productId: 'product-1',
              details: {
                name: 'Updated Phone',
                price: 1000,
              },
            },
          ],
        }).success
      ).toBe(false);
    }
  });

  it('allows explicit cost-price edit markers on bulk changes', () => {
    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'update',
            productId: 'product-1',
            details: {
              name: 'Updated Phone',
              price: 1000,
              cost_price: null,
              cost_price_was_edited: true,
            },
          },
        ],
      }).success
    ).toBe(true);
  });

  it('allows update and remove bulk changes to omit unchanged product names', () => {
    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'update',
            productId: 'product-1',
            details: {
              price: 1000,
              cost_price: null,
              cost_price_was_edited: true,
            },
          },
          {
            type: 'remove',
            productId: 'product-2',
            details: {
              price: 500,
            },
          },
        ],
      }).success
    ).toBe(true);
  });

  it('still requires product names for new bulk products', () => {
    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              price: 1000,
            },
          },
        ],
      }).success
    ).toBe(false);

    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: '   ',
              price: 1000,
            },
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects UI-only cost-price edit markers in AI responses', () => {
    const result = AIResponseSchema.safeParse({
      changes: [
        {
          type: 'update',
          productId: 'product-1',
          details: {
            name: 'Updated Phone',
            price: 1000,
            cost_price: null,
            cost_price_was_edited: true,
          },
        },
      ],
      summary: 'Updated cost price',
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative AI-generated selling prices and update prices', () => {
    expect(
      AIResponseSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: 'New Phone',
              price: -1,
            },
          },
        ],
        summary: 'New product',
      }).success
    ).toBe(false);

    expect(
      AIResponseSchema.safeParse({
        changes: [
          {
            type: 'update',
            newPrice: -1,
            productId: 'product-1',
            details: {
              name: 'Updated Phone',
              price: 1000,
            },
          },
        ],
        summary: 'Updated product',
      }).success
    ).toBe(false);
  });

  it('rejects unexpected root keys in AI responses', () => {
    const result = AIResponseSchema.safeParse({
      changes: [
        {
          type: 'new',
          details: {
            name: 'New Phone',
            price: 1000,
          },
        },
      ],
      summary: 'New product',
      unexpectedRootKey: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected change keys in AI responses', () => {
    const result = AIResponseSchema.safeParse({
      changes: [
        {
          type: 'new',
          details: {
            name: 'New Phone',
            price: 1000,
          },
          unexpectedChangeKey: true,
        },
      ],
      summary: 'New product',
    });

    expect(result.success).toBe(false);
  });

  it('accepts zero and decimal bulk change cost prices', () => {
    for (const costPrice of [0, 10.5]) {
      expect(
        BulkUpdateChangesSchema.safeParse({
          changes: [
            {
              type: 'new',
              details: {
                name: 'New Phone',
                price: 1000,
                cost_price: costPrice,
              },
            },
          ],
        }).success
      ).toBe(true);
    }
  });

  it('rejects invalid bulk change cost prices', () => {
    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: 'New Phone',
              price: 1000,
              cost_price: -1,
            },
          },
        ],
      }).success
    ).toBe(false);

    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: 'New Phone',
              price: 1000,
              cost_price: Number.POSITIVE_INFINITY,
            },
          },
        ],
      }).success
    ).toBe(false);

    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: 'New Phone',
              price: 1000,
              cost_price: Number.NaN,
            },
          },
        ],
      }).success
    ).toBe(false);

    expect(
      BulkUpdateChangesSchema.safeParse({
        changes: [
          {
            type: 'new',
            details: {
              name: 'New Phone',
              price: 1000,
              cost_price: Number.NEGATIVE_INFINITY,
            },
          },
        ],
      }).success
    ).toBe(false);
  });

  it('preserves structural CSV parsing errors while rejecting empty or oversized CSV payloads', () => {
    expect(
      ParseCsvDirectlyInputSchema.safeParse({
        currentProducts,
        csvData: 'SKU,Quantity\nOLD-1,5',
      }).success
    ).toBe(true);
    expect(
      ParseCsvDirectlyInputSchema.safeParse({
        currentProducts,
        csvData: '   ',
      }).success
    ).toBe(false);
    expect(
      ParseCsvDirectlyInputSchema.safeParse({
        currentProducts,
        csvData: 'x'.repeat(MAX_PRICE_LIST_INPUT_CHARS + 1),
      }).success
    ).toBe(false);
  });

  it('validates Google Sheets URLs before fetch authorization work', () => {
    expect(
      FetchGoogleSheetInputSchema.safeParse({
        url: 'https://docs.google.com/spreadsheets/d/sheet-id/edit',
      }).success
    ).toBe(true);
    expect(
      FetchGoogleSheetInputSchema.safeParse({
        url: 'https://docs.google.com/spreadsheets/d/e/published-id/pubhtml',
      }).success
    ).toBe(true);
    expect(
      FetchGoogleSheetInputSchema.safeParse({ url: 'not-a-url' }).success
    ).toBe(false);
    expect(
      FetchGoogleSheetInputSchema.safeParse({
        url: 'https://evil.example.com/spreadsheets/d/sheet-id/edit',
      }).success
    ).toBe(false);
    expect(
      FetchGoogleSheetInputSchema.safeParse({
        url: 'https://docs.google.com/document/d/doc-id/edit',
      }).success
    ).toBe(false);
    expect(
      FetchGoogleSheetInputSchema.safeParse({
        url: `https://docs.google.com/spreadsheets/d/${'x'.repeat(
          MAX_GOOGLE_SHEET_URL_CHARS
        )}/edit`,
      }).success
    ).toBe(false);
  });
});
