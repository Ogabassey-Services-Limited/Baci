import type { Order, OrderItem } from '@baci/shared';
import { describe, expect, it } from 'vitest';
import {
  canUseSelectedShippingProvider,
  formatShippingProviderName,
  getDispatchPhoneFromOrder,
  getInitialFulfillmentDetails,
  orderRequiresFulfillment,
  shouldPersistFulfillmentDetails,
} from '@/lib/order-shipment';

function createItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    name: 'iPhone 13',
    price: 500000,
    product_id: 'product-1',
    product_name: 'iPhone 13',
    quantity: 1,
    ...overrides,
  };
}

function createOrder(
  overrides: Partial<Order> = {}
): Pick<
  Order,
  | 'selected_quote_id'
  | 'shipment_id'
  | 'shipping_provider'
  | 'tracking_number'
  | 'self_fulfillment_data'
> {
  return {
    selected_quote_id: null,
    shipment_id: null,
    shipping_provider: null,
    tracking_number: null,
    self_fulfillment_data: null,
    ...overrides,
  };
}

describe('order-shipment', () => {
  it('requires fulfillment for insured or device-like items', () => {
    expect(orderRequiresFulfillment([])).toBe(false);
    expect(orderRequiresFulfillment([createItem()])).toBe(true);
    expect(
      orderRequiresFulfillment([
        createItem({ has_assurance: false, name: 'Cotton Hoodie' }),
      ])
    ).toBe(false);
    expect(
      orderRequiresFulfillment([
        createItem({ has_assurance: true, name: 'Cotton Hoodie' }),
      ])
    ).toBe(true);
  });

  it('allows provider shipment only when a provider quote is still bookable', () => {
    expect(
      canUseSelectedShippingProvider(
        createOrder({
          selected_quote_id: 'quote-1',
          shipping_provider: 'TOPSHIP',
        })
      )
    ).toBe(true);

    expect(
      canUseSelectedShippingProvider(
        createOrder({
          shipping_provider: 'TOPSHIP',
        })
      )
    ).toBe(false);

    expect(
      canUseSelectedShippingProvider(
        createOrder({
          selected_quote_id: 'quote-1',
          shipment_id: 'shipment-1',
          shipping_provider: 'TOPSHIP',
        })
      )
    ).toBe(false);
  });

  it('formats provider names for user-facing copy', () => {
    expect(formatShippingProviderName('TOPSHIP')).toBe('Topship');
    expect(formatShippingProviderName('GIGL')).toBe('GIG Logistics');
    expect(formatShippingProviderName('self_delivery')).toBe('Self Delivery');
    expect(formatShippingProviderName(null)).toBeNull();
  });

  it('hydrates fulfillment details and dispatch phone from persisted order data', () => {
    expect(
      getInitialFulfillmentDetails({
        imei: ' 353456789012345 ',
        serialNumber: ' SN-123 ',
      })
    ).toEqual({
      imei: '353456789012345',
      serialNumber: 'SN-123',
    });

    expect(
      getInitialFulfillmentDetails({
        imei: '',
        serialNumber: ' ',
        serial_number: ' LEGACY-SN ',
      })
    ).toEqual({
      imei: '',
      serialNumber: 'LEGACY-SN',
    });

    expect(
      getDispatchPhoneFromOrder(
        createOrder({
          self_fulfillment_data: {
            dispatchPhone: ' +2348030000000 ',
          },
        })
      )
    ).toBe('+2348030000000');
  });

  it('persists fulfillment details only when at least one field is present', () => {
    expect(
      shouldPersistFulfillmentDetails({ imei: '', serialNumber: '' })
    ).toBe(false);
    expect(
      shouldPersistFulfillmentDetails({
        imei: '353456789012345',
        serialNumber: 'SN-123',
      })
    ).toBe(true);
    expect(
      shouldPersistFulfillmentDetails({
        imei: '353456789012345',
        serialNumber: '',
      })
    ).toBe(true);
  });
});
