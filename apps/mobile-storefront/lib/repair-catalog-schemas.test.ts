import { describe, expect, it } from '@jest/globals';
import {
  RepairBookingResultSchema,
  RepairDeviceDetailSchema,
  RepairDevicesResponseSchema,
} from './repair-catalog-schemas';

describe('RepairDevicesResponseSchema', () => {
  it('parses a valid grouped devices response', () => {
    const result = RepairDevicesResponseSchema.safeParse({
      groups: [
        {
          brand: 'Apple',
          devices: [
            {
              id: 'd1',
              brand: 'Apple',
              model: 'iPhone 13',
              slug: 'apple-iphone-13',
              deviceType: 'Smartphone',
              imageUrl: null,
              productId: null,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('parses an empty groups array', () => {
    const result = RepairDevicesResponseSchema.safeParse({ groups: [] });

    expect(result.success).toBe(true);
  });

  it('rejects a response missing the groups field', () => {
    const result = RepairDevicesResponseSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects a device missing required fields', () => {
    const result = RepairDevicesResponseSchema.safeParse({
      groups: [{ brand: 'Apple', devices: [{ id: 'd1' }] }],
    });

    expect(result.success).toBe(false);
  });
});

describe('RepairDeviceDetailSchema', () => {
  const baseDevice = {
    id: 'd1',
    brand: 'Apple',
    model: 'iPhone 13',
    slug: 'apple-iphone-13',
    deviceType: 'Smartphone',
    imageUrl: null,
    productId: null,
  };

  it('parses a device detail with quotes and no linked product', () => {
    const result = RepairDeviceDetailSchema.safeParse({
      device: baseDevice,
      quotes: [
        {
          id: 'q1',
          serviceTypeId: 'st1',
          serviceTypeName: 'Screen Replacement',
          price: 25000,
          isFromPrice: true,
          partQuality: null,
          turnaround: null,
          warrantyDays: null,
          description: null,
        },
      ],
      product: null,
    });

    expect(result.success).toBe(true);
  });

  it('parses a device detail with a linked product and key specs', () => {
    const result = RepairDeviceDetailSchema.safeParse({
      device: baseDevice,
      quotes: [],
      product: {
        id: 'p1',
        slug: 'iphone-13',
        name: 'iPhone 13',
        imageUrl: 'https://example.com/img.png',
        keySpecs: [{ label: 'RAM', value: '4GB' }],
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a detail response with a malformed quote', () => {
    const result = RepairDeviceDetailSchema.safeParse({
      device: baseDevice,
      quotes: [{ id: 'q1' }],
      product: null,
    });

    expect(result.success).toBe(false);
  });
});

describe('RepairBookingResultSchema', () => {
  it('parses a valid booking result', () => {
    const result = RepairBookingResultSchema.safeParse({
      id: 'repair-1',
      ticketNumber: 42,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a booking result with a non-numeric ticket number', () => {
    const result = RepairBookingResultSchema.safeParse({
      id: 'repair-1',
      ticketNumber: '42',
    });

    expect(result.success).toBe(false);
  });
});
