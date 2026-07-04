import type { OrderItem } from '@baci/shared';
import { describe, expect, it } from 'vitest';
import {
  areFulfillmentDetailsComplete,
  getInitialFulfillmentDetails,
  getOrderFulfillmentIdentifierItems,
  updateShipmentFulfillmentDetails,
} from './order-fulfillment-details';

function createItem(overrides: Partial<OrderItem> = {}): OrderItem {
  const name = overrides.name ?? '13" iPad Air';

  return {
    id: 'item-1',
    name,
    price: 800000,
    product_id: 'product-1',
    product_name: name,
    quantity: 1,
    ...overrides,
  };
}

describe('order fulfillment details', () => {
  it('creates one identifier entry per required order item unit', () => {
    const items = getOrderFulfillmentIdentifierItems(
      [
        createItem({ id: 'item-1', name: '13" iPad Air', quantity: 1 }),
        createItem({ id: 'item-2', name: 'Apple Pencil Pro', quantity: 2 }),
        createItem({ id: 'item-3', name: 'Cotton Case', quantity: 1 }),
      ],
      'electronics'
    );

    expect(items).toMatchObject([
      { id: 'item-1:1', productName: '13" iPad Air', unitIndex: 0 },
      { id: 'item-2:1', productName: 'Apple Pencil Pro', unitIndex: 0 },
      { id: 'item-2:2', productName: 'Apple Pencil Pro', unitIndex: 1 },
      { id: 'item-3:1', productName: 'Cotton Case', unitIndex: 0 },
    ]);
  });

  it('falls back legacy order-level fields onto the first item when no item identifiers exist', () => {
    const requiredItems = getOrderFulfillmentIdentifierItems([
      createItem({ id: 'item-1', name: 'iPhone 15' }),
      createItem({ id: 'item-2', name: 'Samsung Galaxy' }),
    ]);

    const details = getInitialFulfillmentDetails(
      {
        imei: ' 353456789012345 ',
        serialNumber: ' SN-IPHONEX ',
      },
      requiredItems
    );

    expect(details.items).toMatchObject([
      { id: 'item-1:1', imei: '353456789012345', serialNumber: 'SN-IPHONEX' },
      { id: 'item-2:1', imei: '', serialNumber: '' },
    ]);
  });

  it('does not copy item-level fallback identifiers onto earlier items', () => {
    const requiredItems = getOrderFulfillmentIdentifierItems([
      createItem({ id: 'item-1', name: 'iPhone 15' }),
      createItem({ id: 'item-2', name: 'Samsung Galaxy' }),
    ]);

    const details = getInitialFulfillmentDetails(
      {
        imei: ' 353456789012345 ',
        serialNumber: ' SN-GALAXY-1 ',
        items: [
          {
            id: 'item-1:1',
            imei: '353456789012345',
          },
          {
            id: 'item-2:1',
            serialNumber: ' SN-GALAXY-1 ',
          },
        ],
      },
      requiredItems
    );

    expect(details.items).toMatchObject([
      { id: 'item-1:1', imei: '353456789012345', serialNumber: '' },
      { id: 'item-2:1', imei: '', serialNumber: 'SN-GALAXY-1' },
    ]);
  });

  it('tracks completeness and updates the active item without losing other identifiers', () => {
    const requiredItems = getOrderFulfillmentIdentifierItems([
      createItem({ id: 'item-1', name: 'iPhone 15' }),
      createItem({ id: 'item-2', name: 'Samsung Galaxy' }),
    ]);
    const initialDetails = getInitialFulfillmentDetails(null, requiredItems);

    const firstUpdated = updateShipmentFulfillmentDetails(
      initialDetails,
      0,
      'imei',
      '353456789012345'
    );
    const secondUpdated = updateShipmentFulfillmentDetails(
      firstUpdated,
      1,
      'serialNumber',
      'SN-GALAXY-1'
    );

    expect(areFulfillmentDetailsComplete(firstUpdated)).toBe(false);
    expect(areFulfillmentDetailsComplete(secondUpdated)).toBe(true);
    expect(secondUpdated.items[0].imei).toBe('353456789012345');
    expect(secondUpdated.items[1].serialNumber).toBe('SN-GALAXY-1');
  });
});
