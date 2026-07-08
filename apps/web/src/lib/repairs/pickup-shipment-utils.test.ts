import { describe, expect, it } from 'vitest';
import {
  buildPickupItems,
  buildPickupSender,
  pickupFailure,
  type RepairPickupSource,
} from './pickup-shipment-utils';

const baseRepair: RepairPickupSource = {
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '08012345678',
  device_type: 'Smartphone',
  device_model: 'iPhone 15',
  pickup_address: '12 Aba Road, Port Harcourt, Rivers',
  quoted_price: 45_000,
};

describe('buildPickupSender', () => {
  it('derives city/state from the pickup address', () => {
    const sender = buildPickupSender(baseRepair);
    expect(sender).toMatchObject({
      name: 'Ada Lovelace',
      phone: '08012345678',
      email: 'ada@example.com',
      state: 'Rivers',
      country: 'Nigeria',
      countryCode: 'NG',
    });
  });

  it('returns null when there is no pickup address', () => {
    expect(
      buildPickupSender({ ...baseRepair, pickup_address: null })
    ).toBeNull();
    expect(
      buildPickupSender({ ...baseRepair, pickup_address: '   ' })
    ).toBeNull();
  });

  it('falls back to a placeholder name when missing', () => {
    const sender = buildPickupSender({ ...baseRepair, customer_name: null });
    expect(sender?.name).toBe('Customer');
  });
});

describe('buildPickupItems', () => {
  it('labels the item with device type + model and uses the quoted value', () => {
    const [item] = buildPickupItems(baseRepair);
    expect(item.name).toBe('Smartphone iPhone 15');
    expect(item.value).toBe(45_000);
    expect(item.quantity).toBe(1);
  });

  it('defaults the declared value when no quoted price is present', () => {
    const [item] = buildPickupItems({ ...baseRepair, quoted_price: null });
    expect(item.value).toBe(50_000);
  });

  it('falls back to a generic name when device fields are empty', () => {
    const [item] = buildPickupItems({
      ...baseRepair,
      device_type: null,
      device_model: null,
    });
    expect(item.name).toBe('Device for repair');
  });
});

describe('pickupFailure', () => {
  it('offers manual retry for recoverable reasons', () => {
    expect(pickupFailure('topship_unavailable')).toMatchObject({
      ok: false,
      reason: 'topship_unavailable',
      canRetryManually: true,
    });
  });

  it('does not offer manual retry when the booking is missing', () => {
    expect(pickupFailure('not_found').canRetryManually).toBe(false);
  });
});
