'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { ensurePermission } from '@/lib/merchant-server';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { createClient } from '@/lib/supabase/server';
import {
  type ZoneFormInput,
  zoneFormSchema,
} from '@/schemas/merchant-shipping-rate-forms';
import {
  assertNoCrossZoneLocationOverlap,
  LOCATION_ROW_COLUMNS,
  RATE_ROW_COLUMNS,
  replaceZoneLocations,
  requireAuthenticatedSupabase,
  SHIPPING_SETTINGS_PATH,
  ZONE_ROW_COLUMNS,
} from './shipping-actions-shared';
import {
  RestOfWorldZoneDeleteError,
  RestOfWorldZoneLocationsError,
  ShippingZoneNotFoundError,
} from './shipping-errors';
import { mapRateRows, mapZoneRows } from './shipping-row-mappers';
import type { ShippingConfig } from './shipping-types';

export async function listShippingConfig(): Promise<ShippingConfig> {
  await requireAuthenticatedSupabase();
  const { merchant } = await ensurePermission('settings', 'view');
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: zoneRows, error: zoneError } = await supabase
    .from('merchant_shipping_zones')
    .select(ZONE_ROW_COLUMNS)
    .eq('merchant_id', merchant.id)
    .order('is_rest_of_world', { ascending: true })
    .order('name', { ascending: true });

  if (zoneError) {
    throw new Error(zoneError.message);
  }

  const zoneIds = (zoneRows ?? []).map((zone) => zone.id);
  const { data: locationRows, error: locationError } = zoneIds.length
    ? await supabase
        .from('merchant_shipping_zone_locations')
        .select(LOCATION_ROW_COLUMNS)
        .in('zone_id', zoneIds)
    : { data: [], error: null };

  if (locationError) {
    throw new Error(locationError.message);
  }

  const { data: rateRows, error: rateError } = await supabase
    .from('merchant_shipping_rates')
    .select(RATE_ROW_COLUMNS)
    .eq('merchant_id', merchant.id)
    .order('zone_id', { ascending: true })
    .order('sort_order', { ascending: true });

  if (rateError) {
    throw new Error(rateError.message);
  }

  const currency = resolveMerchantCurrencyConfig(merchant);

  return {
    zones: mapZoneRows(zoneRows ?? [], locationRows ?? []),
    rates: mapRateRows(rateRows ?? []),
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
  };
}

export async function upsertZone(
  input: unknown
): Promise<{ success: true; zoneId: string }> {
  const parsed: ZoneFormInput = zoneFormSchema.parse(input);
  await requireAuthenticatedSupabase();
  const { merchant } = await ensurePermission('settings', 'edit');
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (!parsed.id) {
    // Reject duplicate coverage BEFORE inserting so a conflict never leaves an
    // orphan zone behind.
    await assertNoCrossZoneLocationOverlap({
      supabase,
      merchantId: merchant.id,
      excludeZoneId: null,
      locations: parsed.locations,
    });

    // New zones can never carry the rest-of-world flag — the DB trigger owns
    // creating that zone exactly once per merchant.
    const { data: created, error: insertError } = await supabase
      .from('merchant_shipping_zones')
      .insert({ merchant_id: merchant.id, name: parsed.name })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    try {
      await replaceZoneLocations(supabase, created.id, parsed.locations);
    } catch (locationError) {
      // Compensating action: the zone row already committed (no transaction
      // spans the insert + location replace, and unlike the edit path a new zone
      // has no prior rows for replaceZoneLocations to snapshot-restore). A failed
      // location insert — e.g. the DB no-overlap unique index catching a
      // concurrent/duplicate save that slipped past the
      // assertNoCrossZoneLocationOverlap TOCTOU pre-check — would otherwise leave
      // an orphan zone with no locations (invisible to checkout; any rates added
      // to it never match). Best-effort delete it, then rethrow the original
      // error. Supabase JS has no multi-statement transaction, so if the delete
      // itself errors we log and still surface the original failure.
      const { error: rollbackError } = await supabase
        .from('merchant_shipping_zones')
        .delete()
        .eq('id', created.id)
        .eq('merchant_id', merchant.id);

      if (rollbackError) {
        logger.error({
          message:
            'Failed to roll back orphan shipping zone after a failed location insert',
          zoneId: created.id,
          merchantId: merchant.id,
          rollbackError: rollbackError.message,
        });
      }

      throw locationError;
    }
    revalidatePath(SHIPPING_SETTINGS_PATH);
    return { success: true, zoneId: created.id };
  }

  const { data: existingZone, error: fetchError } = await supabase
    .from('merchant_shipping_zones')
    .select('id, is_rest_of_world')
    .eq('id', parsed.id)
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!existingZone) {
    throw new ShippingZoneNotFoundError();
  }
  if (existingZone.is_rest_of_world && parsed.locations.length > 0) {
    throw new RestOfWorldZoneLocationsError();
  }

  // Reject duplicate coverage against the merchant's OTHER zones (this zone is
  // excluded so re-saving its own unchanged locations is not a self-conflict).
  await assertNoCrossZoneLocationOverlap({
    supabase,
    merchantId: merchant.id,
    excludeZoneId: parsed.id,
    locations: parsed.locations,
  });

  const { error: updateError } = await supabase
    .from('merchant_shipping_zones')
    .update({ name: parsed.name })
    .eq('id', parsed.id)
    .eq('merchant_id', merchant.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // The rest-of-world zone's location set is never touched — it has none by
  // definition (matches any destination at the lowest specificity).
  if (!existingZone.is_rest_of_world) {
    await replaceZoneLocations(supabase, parsed.id, parsed.locations);
  }

  revalidatePath(SHIPPING_SETTINGS_PATH);
  return { success: true, zoneId: parsed.id };
}

export async function deleteZone(zoneId: string): Promise<{ success: true }> {
  const parsedId = z.uuid().parse(zoneId);
  await requireAuthenticatedSupabase();
  const { merchant } = await ensurePermission('settings', 'edit');
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: zone, error: fetchError } = await supabase
    .from('merchant_shipping_zones')
    .select('id, is_rest_of_world')
    .eq('id', parsedId)
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!zone) {
    throw new ShippingZoneNotFoundError();
  }
  if (zone.is_rest_of_world) {
    throw new RestOfWorldZoneDeleteError();
  }

  const { error: deleteError } = await supabase
    .from('merchant_shipping_zones')
    .delete()
    .eq('id', parsedId)
    .eq('merchant_id', merchant.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath(SHIPPING_SETTINGS_PATH);
  return { success: true };
}

export type {
  ShippingConfig,
  ShippingRate,
  ShippingZone,
  ShippingZoneLocation,
} from './shipping-types';
