import { Alert, Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { apiClient } from '@/lib/api-client';
import { asyncStorage as AsyncStorage } from '@/lib/storage';
import { createOrderDetailsContactActions } from './createOrderDetailsContactActions';

vi.mock('@/lib/storage', () => ({
  asyncStorage: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn().mockResolvedValue(undefined) },
  Share: { share: vi.fn() },
}));

function buildOrder(
  overrides: Partial<OrderDetailsRecord> = {}
): OrderDetailsRecord {
  return {
    amount_paid: 0,
    balance: 15000,
    created_at: '2024-01-01T00:00:00.000Z',
    customer_email: 'customer@example.com',
    customer_name: 'Ada',
    customer_phone: '08030000000',
    discount_amount: 0,
    id: 'order-1',
    order_number: 'ORD-1',
    payment_method: 'pay_on_delivery',
    payment_status: 'pending',
    shipping_address: {
      address: '12 Allen Avenue',
      city: 'Ikeja',
      state: 'Lagos',
    },
    shipping_status: 'shipped',
    total: 15000,
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createOrderDetailsContactActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient).mockResolvedValue({ success: true });
  });

  it('normalizes the rider number before saving and opening WhatsApp', async () => {
    const setSavedRiders = vi.fn();
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: {
        business_address: '21 Broad Street',
        business_name: 'Baci Store',
      },
      order: buildOrder(),
      riderPhone: ' +234 803 444 4444 ',
      savedRiders: [],
      setSavedRiders,
    });

    await actions.handleSendOrderDetailsToRider();

    expect(setSavedRiders).toHaveBeenCalledWith(['2348034444444']);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'saved_riders',
      JSON.stringify(['2348034444444'])
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/2348034444444?text=')
    );
  });

  it('includes the customer delivery address in the rider dispatch message', async () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: { business_address: '21 Broad Street', business_name: 'Baci' },
      order: buildOrder(),
      riderPhone: '+2348034444444',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendOrderDetailsToRider();

    const url = vi.mocked(Linking.openURL).mock.calls[0]?.[0] as string;
    const message = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(message).toContain('12 Allen Avenue');
    expect(message).toContain('Ikeja Lagos');
  });

  it('prefixes the dispatch number with + in the customer message', async () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: { business_address: '21 Broad Street', business_name: 'Baci' },
      order: buildOrder({
        self_fulfillment_data: {
          carrierName: 'Dispatch Rider',
          dispatchPhone: '+2348034444444',
        },
      }),
      riderPhone: '',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendRiderToCustomer();

    const url = vi.mocked(Linking.openURL).mock.calls[0]?.[0] as string;
    const message = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(message).toContain('Dispatch Rider: +2348034444444');
  });

  it('persists a typed rider number before sharing it with the customer', async () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: { business_address: '21 Broad Street', business_name: 'Baci' },
      order: buildOrder({
        self_fulfillment_data: {
          carrierName: 'Dispatch Rider',
          dispatchPhone: '',
        },
      }),
      riderPhone: '+2348034444444',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendRiderToCustomer();

    expect(apiClient).toHaveBeenCalledWith('/api/shipping/self-fulfill', {
      body: JSON.stringify({
        carrierName: 'Dispatch Rider',
        dispatchPhone: '2348034444444',
        orderId: 'order-1',
      }),
      method: 'PATCH',
    });
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/08030000000?text=')
    );
  });

  it('uses a newly typed rider number instead of an older saved dispatch phone', async () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: { business_address: '21 Broad Street', business_name: 'Baci' },
      order: buildOrder({
        self_fulfillment_data: {
          carrierName: 'Dispatch Rider',
          dispatchPhone: '+2348031111111',
        },
      }),
      riderPhone: '+2348034444444',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendRiderToCustomer();

    expect(apiClient).toHaveBeenCalledWith('/api/shipping/self-fulfill', {
      body: JSON.stringify({
        carrierName: 'Dispatch Rider',
        dispatchPhone: '2348034444444',
        orderId: 'order-1',
      }),
      method: 'PATCH',
    });
    const url = vi.mocked(Linking.openURL).mock.calls[0]?.[0] as string;
    const message = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(message).toContain('Dispatch Rider: +2348034444444');
    expect(message).not.toContain('2348031111111');
  });

  it('stops before WhatsApp when saving a typed rider number fails', async () => {
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('save failed'));
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: { business_address: '21 Broad Street', business_name: 'Baci' },
      order: buildOrder({
        self_fulfillment_data: {
          carrierName: 'Dispatch Rider',
          dispatchPhone: '',
        },
      }),
      riderPhone: '+2348034444444',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendRiderToCustomer();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Could not save the rider phone number.'
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('stops before rider WhatsApp when saving dispatch details fails', async () => {
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('save failed'));
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: { business_address: '21 Broad Street', business_name: 'Baci' },
      order: buildOrder({
        self_fulfillment_data: {
          carrierName: 'Dispatch Rider',
          dispatchPhone: '',
        },
      }),
      riderPhone: '+2348034444444',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendOrderDetailsToRider();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Could not save the rider phone number.'
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('alerts when the customer WhatsApp number is invalid', () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: null,
      order: buildOrder({ customer_phone: 'abc' }),
      riderPhone: '',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    actions.handleWhatsApp();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid phone number',
      'Customer phone number is not valid for WhatsApp.'
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('alerts when WhatsApp cannot be opened for a valid customer number', async () => {
    vi.mocked(Linking.openURL).mockRejectedValueOnce(new Error('open failed'));
    const actions = createOrderDetailsContactActions({
      formatPrice: (amount) => `₦${amount}`,
      merchant: null,
      order: buildOrder(),
      riderPhone: '',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleWhatsApp();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Could not open WhatsApp'
    );
  });
});
