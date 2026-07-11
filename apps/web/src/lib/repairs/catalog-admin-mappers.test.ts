import { describe, expect, it } from 'vitest';
import {
  buildDeviceInsert,
  buildQuoteInsert,
  buildServiceTypeUpdate,
  mapDeviceRow,
  mapQuoteRow,
  mapServiceTypeRow,
} from './catalog-admin-mappers';

describe('mapServiceTypeRow', () => {
  it('maps snake_case columns to camelCase', () => {
    const result = mapServiceTypeRow({
      id: 's-1',
      name: 'Screen Replacement',
      slug: 'screen-replacement',
      description: null,
      sort_order: 3,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    });
    expect(result).toEqual({
      id: 's-1',
      name: 'Screen Replacement',
      slug: 'screen-replacement',
      description: null,
      sortOrder: 3,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    });
  });
});

describe('mapDeviceRow', () => {
  it('coerces aliases and nullable fields', () => {
    const result = mapDeviceRow({
      id: 'd-1',
      brand: 'Apple',
      model: 'iPhone 12',
      slug: 'apple-iphone-12',
      device_type: 'Smartphone',
      product_id: null,
      aliases: ['iphone twelve', 42],
      image_url: '',
      is_active: false,
      sort_order: 0,
      created_at: 'a',
      updated_at: 'b',
    });
    expect(result.deviceType).toBe('Smartphone');
    expect(result.aliases).toEqual(['iphone twelve']);
    expect(result.imageUrl).toBeNull();
    expect(result.productId).toBeNull();
    expect(result.isActive).toBe(false);
  });

  it('rejects an invalid device type into null', () => {
    const result = mapDeviceRow({
      id: 'd-1',
      brand: 'Apple',
      model: 'X',
      slug: 'apple-x',
      device_type: 'Toaster',
      product_id: 'p-1',
      aliases: [],
      image_url: null,
      is_active: true,
      sort_order: 0,
      created_at: 'a',
      updated_at: 'b',
    });
    expect(result.deviceType).toBeNull();
    expect(result.productId).toBe('p-1');
  });
});

describe('mapQuoteRow', () => {
  it('includes internal notes and coerces numbers', () => {
    const result = mapQuoteRow({
      id: 'q-1',
      device_id: 'd-1',
      service_type_id: 's-1',
      price: '25000.00',
      is_from_price: true,
      part_quality: 'OEM',
      turnaround: null,
      warranty_days: 90,
      description: null,
      internal_notes: 'supplier X',
      is_active: true,
      created_at: 'a',
      updated_at: 'b',
    });
    expect(result.price).toBe(25000);
    expect(result.warrantyDays).toBe(90);
    expect(result.internalNotes).toBe('supplier X');
  });
});

describe('buildDeviceInsert', () => {
  it('maps validated input to columns with merchant + slug', () => {
    const payload = buildDeviceInsert(
      {
        brand: 'Apple',
        model: 'iPhone 12',
        aliases: ['iphone twelve'],
        isActive: true,
      },
      'm-1',
      'apple-iphone-12'
    );
    expect(payload).toMatchObject({
      merchant_id: 'm-1',
      brand: 'Apple',
      model: 'iPhone 12',
      slug: 'apple-iphone-12',
      aliases: ['iphone twelve'],
      is_active: true,
    });
  });
});

describe('buildQuoteInsert', () => {
  it('scopes to the merchant and defaults internal notes to null', () => {
    const payload = buildQuoteInsert(
      {
        deviceId: 'd-1',
        serviceTypeId: 's-1',
        price: 25000,
        isFromPrice: true,
      },
      'm-1'
    );
    expect(payload).toMatchObject({
      merchant_id: 'm-1',
      device_id: 'd-1',
      service_type_id: 's-1',
      price: 25000,
      is_from_price: true,
    });
    expect(payload.internal_notes ?? null).toBeNull();
  });
});

describe('buildServiceTypeUpdate', () => {
  it('only includes provided keys', () => {
    const payload = buildServiceTypeUpdate({ isActive: false });
    expect(payload).toEqual({ is_active: false });
  });

  it('returns an empty object for no changes', () => {
    expect(buildServiceTypeUpdate({})).toEqual({});
  });
});
