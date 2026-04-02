import { describe, expect, it } from 'vitest';
import { mergeOrderItem } from '@/lib/order-items';

interface TestOrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  details?: string;
  is_custom?: boolean;
}

describe('mergeOrderItem', () => {
  it('increments quantity for duplicate catalog items', () => {
    const orderItems: TestOrderItem[] = [
      {
        product_id: 'prod_1',
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        product_id: 'prod_1',
        name: 'Vanilla Cake',
        quantity: 1,
        price: 15000,
      })
    ).toEqual([
      {
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
        product_id: 'custom-2',
        name: 'delivery   fee',
        quantity: 1,
        price: 2500,
        is_custom: true,
      })
    ).toEqual([
      {
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
        product_id: 'custom-1',
        name: 'Delivery Fee',
        quantity: 1,
        price: 2500,
        is_custom: true,
      },
    ];

    expect(
      mergeOrderItem(orderItems, {
        product_id: 'custom-2',
        name: 'Delivery Fee',
        quantity: 1,
        price: 3000,
        is_custom: true,
      })
    ).toEqual([
      {
        product_id: 'custom-1',
        name: 'Delivery Fee',
        quantity: 1,
        price: 2500,
        is_custom: true,
      },
      {
        product_id: 'custom-2',
        name: 'Delivery Fee',
        quantity: 1,
        price: 3000,
        is_custom: true,
      },
    ]);
  });
});
