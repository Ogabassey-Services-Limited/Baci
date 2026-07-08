import { describe, expect, it } from 'vitest';
import {
  createRepairDeviceSchema,
  createRepairQuoteSchema,
  createRepairServiceTypeSchema,
  repairImportCommitSchema,
  repairImportParseSchema,
  updateRepairDeviceSchema,
  updateRepairQuoteSchema,
  updateRepairServiceTypeSchema,
} from './repair-catalog-admin';

describe('createRepairServiceTypeSchema', () => {
  it('accepts a minimal valid service type', () => {
    const result = createRepairServiceTypeSchema.safeParse({
      name: 'Screen Replacement',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Screen Replacement');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('rejects an empty name', () => {
    const result = createRepairServiceTypeSchema.safeParse({ name: '  ' });
    expect(result.success).toBe(false);
  });
});

describe('updateRepairServiceTypeSchema', () => {
  it('accepts a partial update', () => {
    const result = updateRepairServiceTypeSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown mutation of name to empty', () => {
    const result = updateRepairServiceTypeSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('createRepairDeviceSchema', () => {
  it('accepts a device with brand and model only', () => {
    const result = createRepairDeviceSchema.safeParse({
      brand: 'Apple',
      model: 'iPhone 12',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual([]);
    }
  });

  it('rejects an invalid device type', () => {
    const result = createRepairDeviceSchema.safeParse({
      brand: 'Apple',
      model: 'iPhone 12',
      deviceType: 'Toaster',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid productId', () => {
    const result = createRepairDeviceSchema.safeParse({
      brand: 'Apple',
      model: 'iPhone 12',
      productId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a null productId (unlink)', () => {
    const result = updateRepairDeviceSchema.safeParse({ productId: null });
    expect(result.success).toBe(true);
  });
});

describe('createRepairQuoteSchema', () => {
  const base = {
    deviceId: 'a1111111-1111-4111-8111-111111111111',
    serviceTypeId: 'b2222222-2222-4222-8222-222222222222',
    price: 25000,
  };

  it('accepts a valid quote', () => {
    const result = createRepairQuoteSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isFromPrice).toBe(true);
    }
  });

  it('rejects a negative price', () => {
    const result = createRepairQuoteSchema.safeParse({ ...base, price: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing device id', () => {
    const { deviceId: _omit, ...rest } = base;
    const result = createRepairQuoteSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('allows updating price without device id', () => {
    const result = updateRepairQuoteSchema.safeParse({ price: 30000 });
    expect(result.success).toBe(true);
  });
});

describe('repairImportParseSchema', () => {
  it('accepts non-empty text', () => {
    const result = repairImportParseSchema.safeParse({
      text: 'iPhone 12 screen 25000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty text', () => {
    const result = repairImportParseSchema.safeParse({ text: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects text over the size cap', () => {
    const result = repairImportParseSchema.safeParse({
      text: 'a'.repeat(20_001),
    });
    expect(result.success).toBe(false);
  });
});

describe('repairImportCommitSchema', () => {
  it('accepts a batch of reviewed rows', () => {
    const result = repairImportCommitSchema.safeParse({
      rows: [
        {
          brand: 'Apple',
          model: 'iPhone 12',
          repairType: 'Screen Replacement',
          price: 25000,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty batch', () => {
    const result = repairImportCommitSchema.safeParse({ rows: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a row without a repair type', () => {
    const result = repairImportCommitSchema.safeParse({
      rows: [{ brand: 'Apple', model: 'iPhone 12', price: 25000 }],
    });
    expect(result.success).toBe(false);
  });
});
