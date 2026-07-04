import { describe, expect, it } from 'vitest';
import {
  buildOrderFulfillmentDetailsForPersistence,
  normalizeFulfillmentIdentifier,
} from './order-fulfillment-identifiers';

describe('order fulfillment identifiers', () => {
  it('normalizes typed and scanned fulfillment identifiers consistently', () => {
    expect(
      normalizeFulfillmentIdentifier('imei', 'abc353456789012345999')
    ).toBe('353456789012345');
    expect(
      normalizeFulfillmentIdentifier('serialNumber', ' Bosnia sn-123/ab ')
    ).toBe('BOSNIASN-123AB');
  });

  it('persists item-level identifiers with a legacy top-level fallback', () => {
    const details = buildOrderFulfillmentDetailsForPersistence({
      imei: '',
      items: [
        {
          id: 'item-1:1',
          imei: '353456789012345',
          orderItemId: 'item-1',
          productName: 'iPhone 15',
          serialNumber: '',
          unitCount: 1,
          unitIndex: 0,
        },
      ],
      serialNumber: '',
    });

    expect(details).toMatchObject({
      imei: '353456789012345',
      items: [
        {
          id: 'item-1:1',
          imei: '353456789012345',
          orderItemId: 'item-1',
          productName: 'iPhone 15',
          serialNumber: null,
        },
      ],
      serialNumber: null,
    });
  });

  it('preserves complementary top-level identifier fallbacks from different items', () => {
    const details = buildOrderFulfillmentDetailsForPersistence({
      imei: '',
      items: [
        {
          id: 'item-1:1',
          imei: '353456789012345',
          orderItemId: 'item-1',
          productName: 'iPhone 15',
          serialNumber: '',
          unitCount: 1,
          unitIndex: 0,
        },
        {
          id: 'item-2:1',
          imei: '',
          orderItemId: 'item-2',
          productName: 'Samsung Galaxy',
          serialNumber: 'SN-GALAXY-1',
          unitCount: 1,
          unitIndex: 0,
        },
      ],
      serialNumber: '',
    });

    expect(details.imei).toBe('353456789012345');
    expect(details.serialNumber).toBe('SN-GALAXY-1');
    expect(details.items).toMatchObject([
      { imei: '353456789012345', serialNumber: null },
      { imei: null, serialNumber: 'SN-GALAXY-1' },
    ]);
  });

  it('falls back to top-level identifiers when there are no items', () => {
    const details = buildOrderFulfillmentDetailsForPersistence({
      imei: '353456789012345',
      items: [],
      serialNumber: 'SN-1',
    });

    expect(details).toMatchObject({
      imei: '353456789012345',
      items: undefined,
      serialNumber: 'SN-1',
    });
  });
});
