import { describe, expect, it } from 'vitest';
import { buildEditOrderPayload } from './edit-order-payload';

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
    orderItems: [],
    sameAsCustomer: false,
    selectedBranchId: null,
    selectedChannel: 'physical',
    shippingFee: 0,
    taxesToUse: 0,
    ...overrides,
  });
}

describe('buildEditOrderPayload locality regressions', () => {
  it('preserves existing city and state when the customer address is unchanged', () => {
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
});
