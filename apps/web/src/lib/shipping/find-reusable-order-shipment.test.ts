import { describe, expect, it, vi } from 'vitest';
import type { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';
import { findReusableOrderShipment } from './find-reusable-order-shipment';

describe('findReusableOrderShipment', () => {
  it('returns null when no reusable shipment exists', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    await expect(
      findReusableOrderShipment(supabase as never, 'merchant-1', 'order-1')
    ).resolves.toBeNull();
  });

  it('throws when an existing shipment is missing booking details', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'shipment-1',
            provider: 'GIGL',
            provider_shipment_id: null,
            tracking_number: null,
            carrier_name: null,
            estimated_delivery_days: 3,
            label_url: null,
            pickup_scheduled_at: null,
            status: 'booked',
          },
          error: null,
        }),
      }),
    };

    await expect(
      findReusableOrderShipment(supabase as never, 'merchant-1', 'order-1')
    ).rejects.toMatchObject({
      code: 'INCOMPLETE_EXISTING_SHIPMENT',
    } satisfies Partial<OrderShipmentBookingError>);
  });
});
