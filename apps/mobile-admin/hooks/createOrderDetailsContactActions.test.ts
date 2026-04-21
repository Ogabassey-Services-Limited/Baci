import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { createOrderDetailsContactActions } from './createOrderDetailsContactActions';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
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
});
