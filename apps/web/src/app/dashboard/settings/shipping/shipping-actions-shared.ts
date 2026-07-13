/**
 * Shared plumbing for `actions.ts` and `rate-actions.ts` — kept in a plain
 * (non `'use server'`) module so it can hold non-async exports (column
 * lists, the revalidate path) without tripping the "every export must be an
 * async function" constraint Next.js enforces on server-action files.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import type { ZoneFormInput } from '@/schemas/merchant-shipping-rate-forms';
import {
  ShippingZoneLocationOverlapError,
  ZoneLocationReplaceError,
} from './shipping-errors';

export const SHIPPING_SETTINGS_PATH = '/dashboard/settings/shipping';

export const ZONE_ROW_COLUMNS = 'id, name, is_rest_of_world, active';
export const LOCATION_ROW_COLUMNS = 'zone_id, country_code, subdivision_code';
export const RATE_ROW_COLUMNS =
  'id, zone_id, name, kind, currency, base_amount, condition_type, min_subtotal, max_subtotal, free_over_amount, delivery_min_days, delivery_max_days, pickup_address, sort_order, active';

/**
 * Explicit auth check before any permission/DB work, matching the repo's
 * standard action pattern (mirrors `discount-codes/actions.ts`).
 */
export async function requireAuthenticatedSupabase() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  return supabase;
}

type ZoneLocationRow = {
  zone_id: string;
  country_code: string;
  subdivision_code: string | null;
};

/**
 * Replace a zone's location set (delete-then-insert; small per-zone rows).
 *
 * There is no DB transaction around this pair, so a failed insert would
 * otherwise leave the zone with NO locations (silently unreachable in
 * matching). To bound that blast radius we snapshot the existing rows first
 * and, on an insert failure, best-effort re-insert the snapshot. The thrown
 * `ZoneLocationReplaceError` distinguishes "prior rows restored" from "restore
 * also failed" (logged) so the dashboard can message the merchant accurately.
 */
export async function replaceZoneLocations(
  supabase: SupabaseClient,
  zoneId: string,
  locations: ZoneFormInput['locations']
): Promise<void> {
  const { data: snapshot, error: snapshotError } = await supabase
    .from('merchant_shipping_zone_locations')
    .select('zone_id, country_code, subdivision_code')
    .eq('zone_id', zoneId)
    .returns<ZoneLocationRow[]>();

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  const { error: deleteError } = await supabase
    .from('merchant_shipping_zone_locations')
    .delete()
    .eq('zone_id', zoneId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (locations.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from('merchant_shipping_zone_locations')
    .insert(
      locations.map((location) => ({
        zone_id: zoneId,
        country_code: location.countryCode,
        subdivision_code: location.subdivisionCode,
      }))
    );

  if (!insertError) {
    return;
  }

  // Insert failed after the delete already committed — restore the snapshot so
  // the zone is not left empty. Nothing to restore means the zone started
  // empty, so the delete was a no-op and no data was lost.
  const priorRows = snapshot ?? [];
  if (priorRows.length === 0) {
    throw new Error(insertError.message);
  }

  const { error: restoreError } = await supabase
    .from('merchant_shipping_zone_locations')
    .insert(
      priorRows.map((row) => ({
        zone_id: row.zone_id,
        country_code: row.country_code,
        subdivision_code: row.subdivision_code,
      }))
    );

  if (restoreError) {
    logger.error({
      message:
        'Failed to restore shipping zone locations after a failed replace — zone may have lost its locations',
      zoneId,
      insertError: insertError.message,
      restoreError: restoreError.message,
    });
    throw new ZoneLocationReplaceError(false);
  }

  throw new ZoneLocationReplaceError(true);
}

/**
 * Overlap key for a zone location. Country-wide rows (no subdivision) and
 * specific-subdivision rows land in different key spaces, so a country-wide
 * row never collides with a specific subdivision of the same country — that is
 * the intended most-specific-wins layering.
 */
function locationOverlapKey(
  countryCode: string,
  subdivisionCode: string | null
): string {
  return `${countryCode.toUpperCase()}::${(subdivisionCode ?? '').toUpperCase()}`;
}

type OverlapLocationRow = {
  country_code: string;
  subdivision_code: string | null;
  merchant_shipping_zones: { id: string; name: string } | null;
};

/**
 * Reject a zone save whose submitted locations duplicate coverage already owned
 * by ANOTHER of the merchant's zones. Without this, two zones could both claim
 * e.g. country-wide NG (or both claim NG-LA) and the destination→zone match
 * would be arbitrary. Country-wide vs. a specific subdivision is allowed
 * (intended layering) — see `locationOverlapKey`.
 */
export async function assertNoCrossZoneLocationOverlap({
  supabase,
  merchantId,
  excludeZoneId,
  locations,
}: {
  supabase: SupabaseClient;
  merchantId: string;
  /** The zone being edited (excluded from the comparison); null when creating. */
  excludeZoneId: string | null;
  locations: ZoneFormInput['locations'];
}): Promise<void> {
  if (locations.length === 0) {
    return;
  }

  // One read: the merchant's other zones' locations, joined so the conflicting
  // zone name is available for the error. RLS already scopes to this merchant;
  // the explicit merchant_id filter is defence-in-depth.
  let query = supabase
    .from('merchant_shipping_zone_locations')
    .select(
      'country_code, subdivision_code, merchant_shipping_zones!inner(id, name)'
    )
    .eq('merchant_shipping_zones.merchant_id', merchantId);

  if (excludeZoneId) {
    query = query.neq('zone_id', excludeZoneId);
  }

  const { data, error } = await query.returns<OverlapLocationRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const existingKeys = new Map<string, string>();
  for (const row of data ?? []) {
    existingKeys.set(
      locationOverlapKey(row.country_code, row.subdivision_code),
      row.merchant_shipping_zones?.name ?? 'another zone'
    );
  }

  for (const location of locations) {
    const conflictingZoneName = existingKeys.get(
      locationOverlapKey(location.countryCode, location.subdivisionCode)
    );
    if (conflictingZoneName) {
      throw new ShippingZoneLocationOverlapError(conflictingZoneName);
    }
  }
}
