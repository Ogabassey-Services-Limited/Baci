import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { persistReplayedDeliveryMetadata } from './persist-replayed-delivery-metadata';

function createAdminClient(updateResult: { error: unknown }) {
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue(updateResult),
    })),
  }));
  return {
    client: {
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient,
    update,
  };
}

describe('persistReplayedDeliveryMetadata', () => {
  it('backfills canonical metadata when a legacy replay row is missing it', async () => {
    const { client, update } = createAdminClient({ error: null });

    const result = await persistReplayedDeliveryMetadata({
      adminClient: client,
      airportType: 'pickup',
      currentAirportType: null,
      currentDeliveryMethod: null,
      deliveryMethod: 'airport',
      merchantId: 'merchant-id',
      orderId: 'order-id',
    });

    expect(result).toEqual({ attempted: true, error: null });
    expect(update).toHaveBeenCalledWith({
      airport_type: 'pickup',
      delivery_method: 'airport',
    });
  });

  it('does not overwrite metadata already persisted on a replay row', async () => {
    const { client, update } = createAdminClient({ error: null });

    const result = await persistReplayedDeliveryMetadata({
      adminClient: client,
      airportType: 'delivery',
      currentAirportType: 'delivery',
      currentDeliveryMethod: 'airport',
      deliveryMethod: 'airport',
      merchantId: 'merchant-id',
      orderId: 'order-id',
    });

    expect(result).toEqual({ attempted: false, error: null });
    expect(update).not.toHaveBeenCalled();
  });

  it('fills only the missing metadata field on a partially persisted replay row', async () => {
    const { client, update } = createAdminClient({ error: null });

    const result = await persistReplayedDeliveryMetadata({
      adminClient: client,
      airportType: 'pickup',
      currentAirportType: null,
      currentDeliveryMethod: 'airport',
      deliveryMethod: 'airport',
      merchantId: 'merchant-id',
      orderId: 'order-id',
    });

    expect(result).toEqual({ attempted: true, error: null });
    expect(update).toHaveBeenCalledWith({ airport_type: 'pickup' });
  });

  it('returns the persistence error so the route can fail closed for a retry', async () => {
    const persistenceError = { code: 'PGRST001', message: 'temporary outage' };
    const { client } = createAdminClient({ error: persistenceError });

    await expect(
      persistReplayedDeliveryMetadata({
        adminClient: client,
        airportType: 'delivery',
        currentAirportType: null,
        currentDeliveryMethod: null,
        deliveryMethod: 'airport',
        merchantId: 'merchant-id',
        orderId: 'order-id',
      })
    ).resolves.toEqual({ attempted: true, error: persistenceError });
  });
});
