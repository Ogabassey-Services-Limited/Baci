import { describe, expect, it } from 'vitest';
import { mergeOrderItem } from '@/lib/order-items';

interface TestOrderItem {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  price: number;
  details?: string;
  is_custom?: boolean;
  variant_id?: string | null;
}

describe('mergeOrderItem', () => {
  it('returns the new item when the order is empty', () => {
    const nextItem: TestOrderItem = {
      id: 'line-1',
      product_id: 'prod_1',
      name: 'Vanilla Cake',
      quantity: 1,
      price: 15000,
    };

    expect(mergeOrderItem([], nextItem)).toEqual([nextItem]);
  });

  it('increments quantity for duplicate catalog items', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'line-1',
        product_id: 'prod_1',
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'line-2',
        product_id: 'prod_1',
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      })
    ).toEqual([
      {
        id: 'line-1',
        product_id: 'prod_1',
        name: 'Vanilla Cake',
        quantity: 2,
        price: 15000,
      },
    ]);
  });

  it('increments quantity for duplicate quick-add items with normalized names', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'custom-1',
        product_id: 'custom-1',
        name: ' Delivery Fee ',
        quantity: 1,
        price: 2500,
        details: 'Keep existing details',
        is_custom: true,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'custom-2',
        product_id: 'custom-2',
        name: 'delivery   fee',
        quantity: 1,
        price: 2500,
        is_custom: true,
      })
    ).toEqual([
      {
        id: 'custom-1',
        product_id: 'custom-1',
        name: ' Delivery Fee ',
        quantity: 2,
        price: 2500,
        details: 'Keep existing details',
        is_custom: true,
      },
    ]);
  });

  it('keeps quick-add items separate when the price changes', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'custom-1',
        product_id: 'custom-1',
        name: 'Delivery Fee',
        quantity: 1,
        price: 2500,
        is_custom: true,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'custom-2',
        product_id: 'custom-2',
        name: 'Delivery Fee',
        quantity: 1,
        price: 3000,
        is_custom: true,
      })
    ).toEqual([
      {
        id: 'custom-1',
        product_id: 'custom-1',
        name: 'Delivery Fee',
        quantity: 1,
        price: 2500,
        is_custom: true,
      },
      {
        id: 'custom-2',
        product_id: 'custom-2',
        name: 'Delivery Fee',
        quantity: 1,
        price: 3000,
        is_custom: true,
      },
    ]);
  });

  it('increments quantity for duplicate structured variants of the same parent product', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'line-variant-1',
        product_id: 'prod_1',
        variant_id: 'variant_1',
        name: 'Vanilla Cake Used 128GB',
        quantity: 1,
        price: 14000,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'line-variant-2',
        product_id: 'prod_1',
        variant_id: 'variant_1',
        name: 'Vanilla Cake Used 128GB',
        quantity: 1,
        price: 14000,
      })
    ).toEqual([
      {
        id: 'line-variant-1',
        product_id: 'prod_1',
        variant_id: 'variant_1',
        name: 'Vanilla Cake Used 128GB',
        quantity: 2,
        price: 14000,
      },
    ]);
  });

  it('keeps different variants of the same product as separate lines', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'line-variant-1',
        product_id: 'prod_1',
        variant_id: 'variant_1',
        name: 'Vanilla Cake Used 128GB',
        quantity: 1,
        price: 14000,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'line-variant-2',
        product_id: 'prod_1',
        variant_id: 'variant_2',
        name: 'Vanilla Cake Open Box 128GB',
        quantity: 1,
        price: 15000,
      })
    ).toEqual([
      {
        id: 'line-variant-1',
        product_id: 'prod_1',
        variant_id: 'variant_1',
        name: 'Vanilla Cake Used 128GB',
        quantity: 1,
        price: 14000,
      },
      {
        id: 'line-variant-2',
        product_id: 'prod_1',
        variant_id: 'variant_2',
        name: 'Vanilla Cake Open Box 128GB',
        quantity: 1,
        price: 15000,
      },
    ]);
  });

  it('treats null and undefined variant ids as the same base product row', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'line-base-1',
        product_id: 'prod_1',
        variant_id: null,
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'line-base-2',
        product_id: 'prod_1',
        variant_id: undefined,
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      })
    ).toEqual([
      {
        id: 'line-base-1',
        product_id: 'prod_1',
        variant_id: null,
        name: 'Vanilla Cake',
        quantity: 2,
        price: 15000,
      },
    ]);
  });

  it('treats null and missing variant ids as the same base product row', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'line-base-1',
        product_id: 'prod_1',
        variant_id: null,
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'line-base-3',
        product_id: 'prod_1',
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      })
    ).toEqual([
      {
        id: 'line-base-1',
        product_id: 'prod_1',
        variant_id: null,
        name: 'Vanilla Cake',
        quantity: 2,
        price: 15000,
      },
    ]);
  });

  it('keeps non-custom items with null product ids as separate rows', () => {
    const orderItems: TestOrderItem[] = [
      {
        id: 'line-unknown-1',
        product_id: null,
        name: 'Imported Line Item',
        quantity: 1,
        price: 5000,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        id: 'line-unknown-2',
        product_id: null,
        name: 'Imported Line Item',
        quantity: 1,
        price: 5000,
      })
    ).toEqual([
      {
        id: 'line-unknown-1',
        product_id: null,
        name: 'Imported Line Item',
        quantity: 1,
        price: 5000,
      },
      {
        id: 'line-unknown-2',
        product_id: null,
        name: 'Imported Line Item',
        quantity: 1,
        price: 5000,
      },
    ]);
  });
});
