import { Alert, Linking } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn() },
  Share: { share: vi.fn() },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { setItem: vi.fn() },
}));

vi.mock('@/lib/orders', () => ({
  extractOrderDeliveryAddress: vi.fn(() => '12 Main St'),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOrderDetailsContactActions } from './createOrderDetailsContactActions';

const baseOrder = {
  id: 'order-1',
  amount_paid: 0,
  balance: 0,
  created_at: '',
  customer_email: 'ada@example.com',
  customer_name: 'Ada',
  customer_phone: '+2348000000000',
  discount_amount: 0,
  is_credit_order: false,
  order_number: 'ORD-1',
  payment_status: 'paid',
  shipping_address: { address: '12 Main St', city: 'Lagos', state: 'Lagos' },
  shipping_status: 'shipped',
  total: 5000,
  updated_at: '',
} as const;

describe('createOrderDetailsContactActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Linking.openURL as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows alert when rider phone is missing', async () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (n) => `₦${n}`,
      merchant: { business_name: 'Acme' },
      order: baseOrder as never,
      riderPhone: '',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendOrderDetailsToRider();

    expect(Alert.alert).toHaveBeenCalledWith('Required', expect.any(String));
  });

  it('opens WhatsApp URL with rider phone when order and phone are present', async () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (n) => `₦${n}`,
      merchant: { business_name: 'Acme', business_address: '1 Road' },
      order: baseOrder as never,
      riderPhone: '+2348111111111',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    await actions.handleSendOrderDetailsToRider();

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('wa.me/2348111111111')
    );
  });

  it('saves a new rider to AsyncStorage', async () => {
    const setSavedRiders = vi.fn();
    const actions = createOrderDetailsContactActions({
      formatPrice: (n) => `₦${n}`,
      merchant: null,
      order: baseOrder as never,
      riderPhone: '+2348222222222',
      savedRiders: [],
      setSavedRiders,
    });

    await actions.handleSaveRider('+2348222222222');

    expect(setSavedRiders).toHaveBeenCalledWith(['+2348222222222']);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'saved_riders',
      JSON.stringify(['+2348222222222'])
    );
  });

  it('does not save a rider that is already in the list', async () => {
    const setSavedRiders = vi.fn();
    const actions = createOrderDetailsContactActions({
      formatPrice: (n) => `₦${n}`,
      merchant: null,
      order: baseOrder as never,
      riderPhone: '+2348222222222',
      savedRiders: ['+2348222222222'],
      setSavedRiders,
    });

    await actions.handleSaveRider('+2348222222222');

    expect(setSavedRiders).not.toHaveBeenCalled();
  });

  it('opens tel: URL when handleCall is invoked with a phone number', () => {
    const actions = createOrderDetailsContactActions({
      formatPrice: (n) => `₦${n}`,
      merchant: null,
      order: baseOrder as never,
      riderPhone: '',
      savedRiders: [],
      setSavedRiders: vi.fn(),
    });

    actions.handleCall();

    expect(Linking.openURL).toHaveBeenCalledWith('tel:+2348000000000');
  });
});
