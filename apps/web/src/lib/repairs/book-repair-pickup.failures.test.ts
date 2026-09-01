import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderShipmentBookingError } from '@/lib/shipping/order-shipment-booking-utils';
import './book-repair-pickup.test-support';
import { bookRepairPickup } from './book-repair-pickup';
import {
  arrangeHappyRepairPickup,
  getRepairPickupMocks,
  happyResponses,
  makeSupabase,
  merchantId,
  repairId,
} from './book-repair-pickup.test-support';

const mocks = getRepairPickupMocks();

describe('bookRepairPickup persistence and concurrency failures', () => {
  beforeEach(arrangeHappyRepairPickup);

  it('keeps the reservation locked when GIGL booking cannot be confirmed', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const operations: string[] = [];
    mocks.bookShipment.mockRejectedValueOnce(new Error('wallet empty'));
    const supabase = makeSupabase(happyResponses(), operations);

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);
      expect(result).toMatchObject({
        ok: false,
        reason: 'shipment_save_failed',
        canRetryManually: false,
      });
      expect(operations).not.toContain(
        'rpc.release_rejected_repair_pickup_reservation'
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('releases the reservation after a confirmed GIGL booking rejection', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const operations: string[] = [];
    mocks.bookShipment.mockRejectedValueOnce(
      new OrderShipmentBookingError(
        'GIGL rejected the shipment booking request.',
        400,
        'GIGL_BOOKING_VALIDATION_FAILED'
      )
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
      ).toHaveLength(1);
      expect(operations).toContain(
        'rpc.release_rejected_repair_pickup_reservation'
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('preserves the reservation when atomic rejected-booking release fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const operations: string[] = [];
    mocks.bookShipment.mockRejectedValueOnce(
      new OrderShipmentBookingError(
        'GIGL rejected the shipment booking request.',
        400,
        'GIGL_BOOKING_VALIDATION_FAILED'
      )
    );
    const supabase = makeSupabase(
      happyResponses({
        'rpc.release_rejected_repair_pickup_reservation': {
          data: null,
          error: { message: 'atomic release failed' },
        },
      }),
      operations
    );

    try {
      const result = await bookRepairPickup(supabase, merchantId, repairId);

      expect(result).toMatchObject({
        ok: false,
        reason: 'shipment_save_failed',
        canRetryManually: false,
      });
      expect(operations).toContain(
        'rpc.release_rejected_repair_pickup_reservation'
      );
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

  it('fails closed when the repair goes terminal during the claim', async () => {
    const supabase = makeSupabase(
      happyResponses({
        'rpc.claim_repair_pickup_booking': {
          data: [{ claimed: false, shipment_id: null, terminal: true }],
          error: null,
        },
      })
    );

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({ ok: false, reason: 'terminal_status' });
    expect(mocks.getProviderQuotes).toHaveBeenCalled();
    expect(mocks.bookShipment).not.toHaveBeenCalled();
  });

  it('does not book when the quote cannot be persisted', async () => {
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

  it('fails when linking the shipment to the repair errors', async () => {
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

  it('fails when the claimed booking cannot be linked', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabase(
      happyResponses({ 'repairs.update': { data: [], error: null } })
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

  it('fails when the shipment row cannot be saved', async () => {
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

  it('preserves the reservation when finalizing a paid shipment fails', async () => {
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
