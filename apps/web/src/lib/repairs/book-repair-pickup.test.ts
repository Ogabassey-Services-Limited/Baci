import { beforeEach, describe, expect, it } from 'vitest';
import './book-repair-pickup.test-support';
import { bookRepairPickup } from './book-repair-pickup';
import {
  arrangeHappyRepairPickup,
  getRepairPickupMocks,
  happyResponses,
  makeSupabase,
  merchantId,
  repairId,
  repairRow,
  sampleQuote,
} from './book-repair-pickup.test-support';

const mocks = getRepairPickupMocks();

describe('bookRepairPickup', () => {
  beforeEach(() => {
    arrangeHappyRepairPickup();
  });

  it('books a courier pickup and returns the tracking number', async () => {
    const supabase = makeSupabase(happyResponses());

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toEqual({
      ok: true,
      trackingNumber: 'TRK-123',
      carrierName: 'GIG Logistics',
      shipmentId: 'ship-1',
      pickupScheduledAt: '2026-07-10T00:00:00.000Z',
    });
    expect(mocks.bookShipment).toHaveBeenCalledWith(
      'GIGL',
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

  it('returns gigl_unavailable when no quotes come back', async () => {
    mocks.getProviderQuotes.mockResolvedValueOnce([]);
    const supabase = makeSupabase(happyResponses());

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({
      ok: false,
      reason: 'gigl_unavailable',
      canRetryManually: true,
    });
    expect(mocks.bookShipment).not.toHaveBeenCalled();
  });

  it('does not book a station-delivery quote for doorstep repair collection', async () => {
    mocks.getProviderQuotes.mockResolvedValueOnce([
      {
        ...sampleQuote,
        id: 'station-q-1',
        isStationPickup: true,
        stationId: 12,
        stationName: 'Osogbo Experience Centre',
      },
    ]);
    const supabase = makeSupabase(happyResponses());

    const result = await bookRepairPickup(supabase, merchantId, repairId);

    expect(result).toMatchObject({
      ok: false,
      reason: 'gigl_unavailable',
      canRetryManually: true,
    });
    expect(mocks.bookShipment).not.toHaveBeenCalled();
  });
});
