import type { ReceiptOrder } from '@baci/shared';
import { describe, expect, it } from 'vitest';
import type { InvoiceLineItem } from '@/lib/invoice-generator';
import { mergeReceiptItemsWithInvoiceMetadata } from '@/lib/invoice-receipt-item-metadata';

function createReceiptItem(
  overrides: Partial<ReceiptOrder['items'][number]> = {}
): ReceiptOrder['items'][number] {
  return {
    line_id: 1,
    product_id: 'product-1',
    product_name: 'Widget',
    quantity: 1,
    price: 1000,
    ...overrides,
  };
}

function createInvoiceItem(
  overrides: Partial<InvoiceLineItem> = {}
): InvoiceLineItem {
  return {
    line_id: 1,
    product_id: 'product-1',
    name: 'Widget',
    description: 'Invoice description',
    quantity: 1,
    unit_code: 'EA',
    price: 1000,
    line_extension_amount: 1000,
    vat_amount: 75,
    vat_category_code: 'S',
    vat_rate: 7.5,
    sellers_item_id: 'SELLER-1',
    ...overrides,
  };
}

describe('mergeReceiptItemsWithInvoiceMetadata', () => {
  it('matches invoice metadata by explicit line id even when invoice items are out of order', () => {
    const receiptItems = [
      createReceiptItem({ line_id: 1, product_name: 'First item' }),
      createReceiptItem({ line_id: 2, product_name: 'Second item' }),
    ];
    const invoiceItems = [
      createInvoiceItem({
        line_id: 2,
        name: 'Second item',
        description: 'Second invoice line',
        line_extension_amount: 2000,
      }),
      createInvoiceItem({
        line_id: 1,
        name: 'First item',
        description: 'First invoice line',
        line_extension_amount: 1000,
      }),
    ];

    expect(
      mergeReceiptItemsWithInvoiceMetadata(receiptItems, invoiceItems)
    ).toMatchObject([
      { description: 'First invoice line', line_extension_amount: 1000 },
      { description: 'Second invoice line', line_extension_amount: 2000 },
    ]);
  });

  it('uses a unique seller item id when line ids are absent', () => {
    const receiptItems = [
      createReceiptItem({
        line_id: undefined,
        sellers_item_id: 'SKU-123',
      }),
    ];
    const invoiceItems = [
      createInvoiceItem({
        line_id: undefined,
        sellers_item_id: 'SKU-123',
        description: 'Matched by SKU',
      }),
    ];

    expect(
      mergeReceiptItemsWithInvoiceMetadata(receiptItems, invoiceItems)[0]
    ).toMatchObject({
      description: 'Matched by SKU',
      sellers_item_id: 'SKU-123',
    });
  });

  it('uses product, quantity, and price when line and seller ids are absent', () => {
    const receiptItems = [
      createReceiptItem({
        line_id: undefined,
        product_id: 'product-123',
        sellers_item_id: null,
        quantity: 2,
        price: 1500,
      }),
    ];
    const invoiceItems = [
      createInvoiceItem({
        line_id: undefined,
        product_id: 'product-123',
        sellers_item_id: undefined,
        quantity: 2,
        price: 1500,
        description: 'Matched by product and amount',
        line_extension_amount: 3000,
      }),
    ];

    expect(
      mergeReceiptItemsWithInvoiceMetadata(receiptItems, invoiceItems)[0]
    ).toMatchObject({
      description: 'Matched by product and amount',
      line_extension_amount: 3000,
    });
  });

  it('uses name, quantity, and price when stronger identifiers are absent', () => {
    const receiptItems = [
      createReceiptItem({
        line_id: undefined,
        product_id: null,
        product_name: '  fallback   WIDGET ',
        sellers_item_id: null,
        quantity: 3,
        price: 500,
      }),
    ];
    const invoiceItems = [
      createInvoiceItem({
        line_id: undefined,
        product_id: undefined,
        name: 'Fallback Widget',
        sellers_item_id: undefined,
        quantity: 3,
        price: 500,
        description: 'Matched by normalized name',
        line_extension_amount: 1500,
      }),
    ];

    expect(
      mergeReceiptItemsWithInvoiceMetadata(receiptItems, invoiceItems)[0]
    ).toMatchObject({
      description: 'Matched by normalized name',
      line_extension_amount: 1500,
    });
  });

  it('preserves existing receipt metadata when matched invoice fields are nullish', () => {
    const receiptItems = [
      createReceiptItem({
        description: 'Existing receipt description',
        line_extension_amount: 999,
        sellers_item_id: 'EXISTING-SELLER',
        unit_code: 'BOX',
        vat_amount: 10,
        vat_category_code: 'Z',
        vat_rate: 0,
      }),
    ];
    const invoiceItems = [
      createInvoiceItem({
        description: undefined,
        line_extension_amount: undefined,
        sellers_item_id: undefined,
        unit_code: undefined,
        vat_amount: undefined,
        vat_category_code: undefined,
        vat_rate: undefined,
      }),
    ];

    expect(
      mergeReceiptItemsWithInvoiceMetadata(receiptItems, invoiceItems)[0]
    ).toMatchObject({
      description: 'Existing receipt description',
      line_extension_amount: 999,
      sellers_item_id: 'EXISTING-SELLER',
      unit_code: 'BOX',
      vat_amount: 10,
      vat_category_code: 'Z',
      vat_rate: 0,
    });
  });

  it('does not fall back to array index when no stable key matches', () => {
    const receiptItems = [
      createReceiptItem({
        line_id: undefined,
        product_id: 'receipt-product',
        product_name: 'Receipt item',
        sellers_item_id: null,
      }),
    ];
    const invoiceItems = [
      createInvoiceItem({
        line_id: undefined,
        product_id: 'invoice-product',
        name: 'Different invoice item',
        sellers_item_id: undefined,
        description: 'Should not be copied',
      }),
    ];

    expect(
      mergeReceiptItemsWithInvoiceMetadata(receiptItems, invoiceItems)[0]
    ).toEqual(receiptItems[0]);
  });

  it('avoids ambiguous fallback matches for duplicate item names', () => {
    const receiptItems = [
      createReceiptItem({
        line_id: undefined,
        product_id: null,
        product_name: 'Duplicate',
        sellers_item_id: null,
      }),
    ];
    const invoiceItems = [
      createInvoiceItem({
        line_id: undefined,
        product_id: undefined,
        name: 'Duplicate',
        sellers_item_id: undefined,
        description: 'First duplicate',
      }),
      createInvoiceItem({
        line_id: undefined,
        product_id: undefined,
        name: 'Duplicate',
        sellers_item_id: undefined,
        description: 'Second duplicate',
      }),
    ];

    expect(
      mergeReceiptItemsWithInvoiceMetadata(receiptItems, invoiceItems)[0]
    ).toEqual(receiptItems[0]);
  });
});
