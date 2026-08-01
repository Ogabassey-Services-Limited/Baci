import { describe, expect, it } from 'vitest';
import type { OrderItem } from '@/components/orders/new-order.types';
import {
  buildEditOrderPayload,
  isOrderFinanciallyLocked,
  mapOrderItemsForEdit,
  readShippingAddressValue,
} from './edit-order-payload';

const orderItems: OrderItem[] = [
  {
    condition: 'new',
    details: 'Battery health 89%',
    id: 'line-1',
    image_url: 'https://example.test/phone.jpg',
    name: 'Phone',
    price: 1000,
    product_id: 'product-1',
    product_match_status: 'linked',
    quantity: 2,
    variant_attributes: { color: 'Blue', storage: '512GB' },
    variant_id: 'variant-1',
    variant_name: 'Blue / 512GB',
  },
];

type EditOrderPayloadInput = Parameters<typeof buildEditOrderPayload>[0];

function buildPayload(
  overrides: Partial<EditOrderPayloadInput> = {}
): ReturnType<typeof buildEditOrderPayload> {
  return buildEditOrderPayload({
    customer: {
      address: '1 Baci Road',
      email: 'ada@example.com',
      id: 'customer-1',
      name: 'Ada Buyer',
      phone: '08030000000',
    },
    deliveryInfo: {
      address: '22 Delivery Lane',
      city: 'Ikeja',
      name: 'Receiver',
      phone: '08039999999',
      state: 'Lagos',
    },
    discount: 0,
    notes: '',
    notifyCustomer: false,
    orderItems,
    sameAsCustomer: false,
    selectedBranchId: null,
    selectedChannel: 'physical',
    shippingFee: 0,
    taxesToUse: 0,
    ...overrides,
  });
}

describe('isOrderFinanciallyLocked', () => {
  it('locks paid, fulfilled, wallet-funded, and terminal orders from financial edits', () => {
    const lockedStates = [
      { amount_paid: 1, payment_status: 'pending', shipping_status: 'pending' },
      { amount_paid: 0, payment_status: 'paid', shipping_status: 'pending' },
      { amount_paid: 0, payment_status: 'pending', shipping_status: 'shipped' },
      {
        amount_paid: 0,
        payment_status: 'pending',
        shipping_status: 'pending',
        wallet_amount_used: 500,
      },
    ];

    for (const state of lockedStates) {
      expect(
        isOrderFinanciallyLocked({ wallet_amount_used: 0, ...state })
      ).toBe(true);
    }

    expect(
      isOrderFinanciallyLocked({
        amount_paid: 0,
        payment_status: 'pending',
        shipping_status: 'pending',
        wallet_amount_used: 0,
      })
    ).toBe(false);
  });
});

describe('buildEditOrderPayload', () => {
  it('builds the full replacement payload with item snapshot fields and notify flag', () => {
    expect(
      buildPayload({
        customer: {
          address: '1 Baci Road',
          email: 'ADA@EXAMPLE.COM',
          id: 'customer-1',
          name: ' Ada Buyer ',
          phone: '08030000000',
        },
        deliveryInfo: {
          address: '22 Delivery Lane',
          city: 'Ikeja',
          name: 'Receiver',
          phone: '08039999999',
          state: 'Lagos',
        },
        discount: 100,
        notes: '  Handle carefully  ',
        notifyCustomer: true,
        orderItems,
        sameAsCustomer: false,
        selectedBranchId: 'branch-1',
        selectedChannel: 'physical',
        shippingFee: 250,
        taxesToUse: 75,
      })
    ).toEqual({
      branch_id: 'branch-1',
      customer: {
        email: 'ada@example.com',
        id: 'customer-1',
        name: 'Ada Buyer',
        phone: '08030000000',
      },
      discount_amount: 100,
      items: [
        {
          condition: 'new',
          image_url: 'https://example.test/phone.jpg',
          item_description: 'Battery health 89%',
          name: 'Phone',
          price: 1000,
          product_id: 'product-1',
          product_match_status: 'linked',
          quantity: 2,
          variant_attributes: { color: 'Blue', storage: '512GB' },
          variant_id: 'variant-1',
          variant_name: 'Blue / 512GB',
        },
      ],
      notes: 'Handle carefully',
      notify_customer: true,
      shipping_address: {
        address: '22 Delivery Lane',
        city: 'Ikeja',
        name: 'Receiver',
        phone: '08039999999',
        state: 'Lagos',
      },
      shipping_fee: 250,
      source: 'physical',
      tax_amount: 75,
    });
  });

  it('uses customer details for shipping when sameAsCustomer is true', () => {
    const payload = buildPayload({
      sameAsCustomer: true,
    });

    expect(payload.shipping_address).toEqual({
      address: '1 Baci Road',
      city: null,
      name: 'Ada Buyer',
      phone: '08030000000',
      state: null,
    });
  });

  it('preserves the existing city and state when the customer address is unchanged', () => {
    const payload = buildPayload({
      customer: {
        address: '1 Baci Road',
        email: 'ada@example.com',
        id: 'customer-1',
        name: 'Ada Buyer',
        phone: '08030000000',
      },
      deliveryInfo: {
        address: '1 Baci Road',
        city: 'Lekki',
        name: 'Ada Buyer',
        phone: '08030000000',
        state: 'Lagos',
      },
      sameAsCustomer: true,
    });

    expect(payload.shipping_address).toMatchObject({
      city: 'Lekki',
      state: 'Lagos',
    });
  });

  it('does not reuse stale delivery city/state when shipping matches the selected customer', () => {
    const payload = buildPayload({
      deliveryInfo: {
        address: '22 Delivery Lane',
        city: 'Old City',
        name: 'Receiver',
        phone: '08039999999',
        state: 'Old State',
      },
      sameAsCustomer: true,
    });

    expect(payload.shipping_address).toMatchObject({
      address: '1 Baci Road',
      city: null,
      state: null,
    });
  });

  it('does not preserve stale locality when both customer and delivery addresses are blank', () => {
    const payload = buildPayload({
      customer: {
        address: '',
        email: 'ada@example.com',
        id: 'customer-1',
        name: 'Ada Buyer',
        phone: '08030000000',
      },
      deliveryInfo: {
        address: '',
        city: 'Old City',
        name: 'Ada Buyer',
        phone: '08030000000',
        state: 'Old State',
      },
      sameAsCustomer: true,
    });

    expect(payload.shipping_address).toMatchObject({
      address: '',
      city: null,
      state: null,
    });
  });

  it('normalizes blank delivery city and state to null', () => {
    const payload = buildPayload({
      deliveryInfo: {
        address: '22 Delivery Lane',
        city: '   ',
        name: 'Receiver',
        phone: '08039999999',
        state: '',
      },
    });

    expect(payload.shipping_address).toMatchObject({
      city: null,
      state: null,
    });
  });

  it('preserves variant snapshot fields when a linked item has no variant id', () => {
    const payload = buildPayload({
      orderItems: [
        {
          ...orderItems[0],
          variant_attributes: { color: 'Blue' },
          variant_id: null,
          variant_name: 'Blue',
        },
      ],
    });

    expect(payload.items[0]).toMatchObject({
      variant_attributes: { color: 'Blue' },
      variant_id: null,
      variant_name: 'Blue',
    });
  });

  it('preserves unreviewed product match status before submit', () => {
    const payload = buildPayload({
      orderItems: [
        {
          ...orderItems[0],
          is_custom: false,
          product_id: null,
          product_match_status: 'unreviewed',
        },
      ],
    });

    expect(payload.items[0]).toMatchObject({
      product_id: null,
      product_match_status: 'unreviewed',
    });
  });

  it('uses the walk-in customer fallback for blank customer names', () => {
    const payload = buildPayload({
      customer: {
        address: '',
        email: '',
        id: null,
        name: '   ',
        phone: '',
      },
      deliveryInfo: { address: '', city: '', name: '', phone: '', state: '' },
      sameAsCustomer: true,
    });

    expect(payload.customer.name).toBe('Walk-in Customer');
  });
});

describe('edit order prefill helpers', () => {
  it('reads legacy and current shipping address shapes', () => {
    expect(
      readShippingAddressValue({ address_line1: 'Legacy street' }, 'address')
    ).toBe('Legacy street');
    expect(readShippingAddressValue({ city: 'Ikeja' }, 'city')).toBe('Ikeja');
  });

  it('maps saved order item snapshots back into editable order items', () => {
    expect(
      mapOrderItemsForEdit([
        {
          id: 'item-1',
          item_description: 'Open box',
          name: 'Samsung',
          price: 1200,
          product_id: 'product-1',
          quantity: 2,
          variant_attributes: { color: 'Black' },
          variant_id: 'variant-1',
          variant_name: 'Black',
        },
      ])
    ).toEqual([
      {
        condition: undefined,
        details: 'Open box',
        id: 'item-1',
        image_url: undefined,
        is_custom: false,
        name: 'Samsung',
        price: 1200,
        product_id: 'product-1',
        product_match_status: 'linked',
        quantity: 2,
        variant_attributes: { color: 'Black' },
        variant_id: 'variant-1',
        variant_name: 'Black',
      },
    ]);
  });

  it('keeps product-less unreviewed snapshots distinct from custom items', () => {
    expect(
      mapOrderItemsForEdit([
        {
          id: 'item-2',
          item_description: 'Imported line',
          name: 'Imported Samsung',
          price: 1200,
          product_id: null,
          product_match_status: 'unreviewed',
          quantity: 1,
          variant_attributes: { color: 'Silver', storage: '256GB' },
          variant_id: null,
          variant_name: 'Silver / 256GB',
        },
      ])
    ).toEqual([
      expect.objectContaining({
        id: 'item-2',
        is_custom: false,
        product_id: null,
        product_match_status: 'unreviewed',
        variant_attributes: { color: 'Silver', storage: '256GB' },
        variant_id: null,
        variant_name: 'Silver / 256GB',
      }),
    ]);
  });

  it('generates distinct fallback ids for duplicate saved snapshots', () => {
    expect(
      mapOrderItemsForEdit([
        {
          name: 'Samsung',
          price: 1200,
          product_id: 'product-1',
          quantity: 1,
          variant_id: 'variant-1',
        },
        {
          name: 'Samsung',
          price: 1200,
          product_id: 'product-1',
          quantity: 1,
          variant_id: 'variant-1',
        },
      ])
    ).toEqual([
      expect.objectContaining({
        id: 'product-1::variant-1::0',
        product_id: 'product-1',
        variant_id: 'variant-1',
      }),
      expect.objectContaining({
        id: 'product-1::variant-1::1',
        product_id: 'product-1',
        variant_id: 'variant-1',
      }),
    ]);
  });

  it('skips malformed saved order item snapshots', () => {
    expect(mapOrderItemsForEdit([null, 'bad item'])).toEqual([]);
  });
});
