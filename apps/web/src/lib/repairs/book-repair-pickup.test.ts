import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShippingBookingRejectedError } from '@/lib/shipping/types';
import { bookRepairPickup } from './book-repair-pickup';

const mocks = vi.hoisted(() => ({
  getProviderQuotes: vi.fn(),
  bookShipment: vi.fn(),
  getRepairCenterAddress: vi.fn(),
}));

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getProviderQuotes: mocks.getProviderQuotes,
    bookShipment: mocks.bookShipment,
  },
}));

vi.mock('@/lib/repairs/repair-center-address', () => ({
  getRepairCenterAddress: mocks.getRepairCenterAddress,
}));

const merchantId = 'm-1';
const repairId = 'r-1';

const repairRow = {
  id: repairId,
  merchant_id: merchantId,
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '08012345678',
  device_type: 'Smartphone',
  device_model: 'iPhone 15',
  pickup_address: '12 Aba Road, Port Harcourt, Rivers',
  shipment_id: null,
  quoted_price: 45_000,
  status: 'confirmed',
};

const repairCenter = {
  name: 'Ogabassey Repair Center',
  phone: '09070007000',
  email: 'repairs@ogabassey.com',
  address: '3 Olayeni Street',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

const sampleQuote = {
  id: 'q-1',
  provider: 'TOPSHIP' as const,
  serviceTier: 'Budget',
  carrierName: 'Topship',
  displayName: 'Topship - Budget',
  estimatedDays: 3,
  price: 3500,
  currency: 'NGN' as const,
  pickupIncluded: true,
  insuranceIncluded: true,
  providerRateId: 'Budget_Standard',
  expiresAt: new Date('2026-07-09T00:00:00.000Z'),
  rawResponse: { cost: 350_000 },
};

const bookingResult = {
  provider: 'TOPSHIP' as const,
  providerShipmentId: 'ts-1',
  trackingNumber: 'TRK-123',
  carrierName: 'Topship - Budget',
  status: 'booked' as const,
  pickupScheduledAt: new Date('2026-07-10T00:00:00.000Z'),
};

type Responses = Record<string, { data: unknown; error: unknown }>;

function makeSupabase(
  responses: Responses,
  operations: string[] = []
): SupabaseClient {
  return {
    rpc(name: string) {
      return Promise.resolve(
        responses[`rpc.${name}`] ?? {
          data: null,
          error: { message: `missing rpc mock: ${name}` },
        }
      );
    },
    from(table: string) {
      let op = 'select';
      const builder = {
        select() {
          return builder;
        },
        insert() {
          op = 'insert';
          return builder;
        },
        update() {
          op = 'update';
          operations.push(`${table}.update`);
          return builder;
        },
        delete() {
          op = 'delete';
          operations.push(`${table}.delete`);
          return builder;
        },
        eq() {
          return builder;
        },
        is() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(responses[`${table}.select`]);
        },
        single() {
          return Promise.resolve(responses[`${table}.${op}`]);
        },
        // biome-ignore lint/suspicious/noThenProperty: test double mimics a thenable query builder for awaited update chains
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          return Promise.resolve(responses[`${table}.${op}`]).then(onF, onR);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

function happyResponses(overrides: Partial<Responses> = {}): Responses {
  return {
    'repairs.select': { data: repairRow, error: null },
    'repairs.update': { data: [{ id: repairId }], error: null },
    'rpc.claim_repair_pickup_booking': {
      data: [{ claimed: true, shipment_id: null }],
      error: null,
    },
    'repair_pickup_quotes.insert': { data: { id: 'pq-1' }, error: null },
    'repair_pickup_quotes.update': { data: null, error: null },
    'shipments.insert': { data: { id: 'ship-1' }, error: null },
    'shipments.update': { data: { id: 'ship-1' }, error: null },
    'shipments.delete': { data: null, error: null },
    ...overrides,
  };
}

describe('bookRepairPickup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRepairCenterAddress.mockResolvedValue(repairCenter);
    mocks.getProviderQuotes.mockResolvedValue([sampleQuote]);
    mocks.bookShipment.mockResolvedValue(bookingResult);
  });

  it('books a courier pickup and returns the tracking number', async () => {
    const supabase = makeSupabase(happyResponses());

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toEqual({
      ok: true,
      trackingNumber: 'TRK-123',
      carrierName: 'Topship - Budget',
      shipmentId: 'ship-1',
      pickupScheduledAt: '2026-07-10T00:00:00.000Z',
    });
    expect(mocks.bookShipment).toHaveBeenCalledWith(
      'TOPSHIP',
      expect.objectContaining({
        pickupType: 'pickup',
        quoteMetadata: { cost: 350_000 },
      })
    );
  });

  it('returns not_found when the repair is missing', async () => {
    const supabase = makeSupabase(
      happyResponses({ 'repairs.select': { data: null, error: null } })
    );

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({ ok: false, reason: 'not_found' });
    expect(mocks.getProviderQuotes).not.toHaveBeenCalled();
  });

  it('returns already_booked when a shipment is already linked', async () => {
    const supabase = makeSupabase(
      happyResponses({
        'repairs.select': {
          data: { ...repairRow, shipment_id: 'ship-existing' },
          error: null,
        },
      })
    );

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({ ok: false, reason: 'already_booked' });
  });

  it('refuses to book a pickup for a terminal (completed) repair', async () => {
    const supabase = makeSupabase(
      happyResponses({
        'repairs.select': {
          data: { ...repairRow, status: 'completed' },
          error: null,
        },
      })
    );

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({ ok: false, reason: 'terminal_status' });
    expect(mocks.getProviderQuotes).not.toHaveBeenCalled();
  });

  it('returns missing_pickup_address when the booking has no pickup address', async () => {
    const supabase = makeSupabase(
      happyResponses({
        'repairs.select': {
          data: { ...repairRow, pickup_address: null },
          error: null,
        },
      })
    );

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({
      ok: false,
      reason: 'missing_pickup_address',
      canRetryManually: true,
    });
  });

  it('returns repair_center_unconfigured when no repair address is set', async () => {
    mocks.getRepairCenterAddress.mockResolvedValueOnce(null);
    const supabase = makeSupabase(happyResponses());

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({
      ok: false,
      reason: 'repair_center_unconfigured',
    });
    expect(mocks.getProviderQuotes).not.toHaveBeenCalled();
  });

  it('returns topship_unavailable when no quotes come back', async () => {
    mocks.getProviderQuotes.mockResolvedValueOnce([]);
    const supabase = makeSupabase(happyResponses());

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({
      ok: false,
      reason: 'topship_unavailable',
      canRetryManually: true,
    });
    expect(mocks.bookShipment).not.toHaveBeenCalled();
  });

  it('keeps the reservation locked when Topship booking cannot be confirmed', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.bookShipment.mockRejectedValueOnce(new Error('wallet empty'));
    const supabase = makeSupabase(happyResponses());

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);
      expect(result).toMatchObject({
        ok: false,
        reason: 'shipment_save_failed',
        canRetryManually: false,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('releases the reservation after a confirmed Topship payment rejection', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const operations: string[] = [];
    mocks.bookShipment.mockRejectedValueOnce(
      new ShippingBookingRejectedError('wallet empty')
    );
    const supabase = makeSupabase(happyResponses(), operations);

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);
      expect(result).toMatchObject({
        ok: false,
        reason: 'booking_failed',
        canRetryManually: true,
      });
      expect(
        operations.filter((operation) => operation === 'repairs.update')
      ).toHaveLength(2);
      expect(operations).toContain('shipments.delete');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns booking_in_progress without booking when another request owns the claim', async () => {
    const supabase = makeSupabase(
      happyResponses({
        'rpc.claim_repair_pickup_booking': {
          data: [{ claimed: false, shipment_id: null }],
          error: null,
        },
      })
    );

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({
      ok: false,
      reason: 'booking_in_progress',
      canRetryManually: false,
    });
    expect(mocks.bookShipment).not.toHaveBeenCalled();
  });

  it('returns already_booked without booking when the claim sees a shipment', async () => {
    const supabase = makeSupabase(
      happyResponses({
        'rpc.claim_repair_pickup_booking': {
          data: [{ claimed: false, shipment_id: 'ship-existing' }],
          error: null,
        },
      })
    );

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({
      ok: false,
      reason: 'already_booked',
      canRetryManually: false,
    });
    expect(mocks.bookShipment).not.toHaveBeenCalled();
  });

  it('returns booking_failed (without booking) when the quote cannot be persisted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabase(
      happyResponses({
        'repair_pickup_quotes.insert': {
          data: null,
          error: { message: 'insert boom' },
        },
      })
    );

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);
      expect(result).toMatchObject({ ok: false, reason: 'booking_failed' });
      expect(mocks.bookShipment).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns shipment_save_failed when linking the shipment to the repair errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabase(
      happyResponses({
        'repairs.update': { data: null, error: { message: 'link boom' } },
      })
    );

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);
      expect(result).toMatchObject({
        ok: false,
        reason: 'shipment_save_failed',
      });
      expect(mocks.bookShipment).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns shipment_save_failed when the claimed booking cannot be linked', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabase(
      happyResponses({
        'repairs.update': { data: [], error: null },
      })
    );

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);
      expect(result).toMatchObject({
        ok: false,
        reason: 'shipment_save_failed',
        canRetryManually: false,
      });
      expect(mocks.bookShipment).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns shipment_save_failed when the shipment row cannot be saved', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabase(
      happyResponses({
        'shipments.insert': { data: null, error: { message: 'boom' } },
      })
    );

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);
      expect(result).toMatchObject({
        ok: false,
        reason: 'shipment_save_failed',
      });
      expect(mocks.bookShipment).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('preserves the linked reservation when finalizing a paid shipment fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabase(
      happyResponses({
        'shipments.update': { data: null, error: { message: 'finalize boom' } },
      })
    );

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);

      expect(result).toMatchObject({
        ok: false,
        reason: 'shipment_save_failed',
        canRetryManually: false,
      });
      expect(mocks.bookShipment).toHaveBeenCalledTimes(1);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
