import type { Order } from '@baci/shared';
import type { OrderItemQueryData } from './orderReportTypes';

interface MakeOrderOverrides extends Partial<Order> {
  shipping_address?: Order['shipping_address'];
}

export function makeOrder(overrides: MakeOrderOverrides = {}): Order {
  return {
    created_at: '2026-05-10T08:30:00.000Z',
    currency: 'NGN',
    customer_email: 'ada@example.com',
    customer_name: 'Ada Lovelace',
    customer_phone: '+2348000000000',
    discount_amount: 500,
    id: 'order_1',
    merchant_id: 'merchant_1',
    notes: null,
    order_number: 'BAC-001',
    payment_method: 'bank_transfer',
    payment_status: 'paid',
    shipping_address: {
      address_line1: '42 Allen Avenue',
      city: 'Ikeja',
      country: 'Nigeria',
      postal_code: '100001',
      state: 'Lagos',
    },
    shipping_fee: 1500,
    shipping_status: 'delivered',
    source: 'storefront',
    subtotal: 9500,
    tax_amount: 1000,
    total: 11500,
    updated_at: '2026-05-10T09:00:00.000Z',
    ...overrides,
  };
}

export function makeOrderItemQueryData(
  overrides: Partial<OrderItemQueryData> = {}
): OrderItemQueryData {
  return {
    price: 2500,
    product_id: 'product_1',
    products: { name: 'Laptop Bag' },
    quantity: 2,
    ...overrides,
  };
}
