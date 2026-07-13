/**
 * DB row (snake_case) -> dashboard shape (camelCase) mapping for
 * `app/dashboard/settings/shipping/actions.ts`. Split out from `actions.ts`
 * so the pure data-shaping logic has its own colocated test file and stays
 * out of the server-action file's line budget.
 */

import type { MerchantPickupAddress } from '@/lib/shipping/merchant-rates/types';
import type {
  ShippingRate,
  ShippingZone,
  ShippingZoneLocation,
} from './shipping-types';

export interface ShippingZoneRow {
  id: string;
  name: string;
  is_rest_of_world: boolean;
  active: boolean;
}

export interface ShippingZoneLocationRow {
  zone_id: string;
  country_code: string;
  subdivision_code: string | null;
}

export interface ShippingRateRow {
  id: string;
  zone_id: string;
  name: string;
  kind: string;
  currency: string;
  base_amount: number;
  condition_type: string;
  min_subtotal: number | null;
  max_subtotal: number | null;
  free_over_amount: number | null;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  pickup_address: unknown;
  sort_order: number;
  active: boolean;
}

/** Group location rows by their owning zone id. */
export function groupLocationsByZone(
  rows: ShippingZoneLocationRow[]
): Map<string, ShippingZoneLocation[]> {
  const byZone = new Map<string, ShippingZoneLocation[]>();
  for (const row of rows) {
    const location: ShippingZoneLocation = {
      countryCode: row.country_code,
      subdivisionCode: row.subdivision_code,
    };
    const existing = byZone.get(row.zone_id);
    if (existing) {
      existing.push(location);
    } else {
      byZone.set(row.zone_id, [location]);
    }
  }
  return byZone;
}

/** Merge zone rows with their grouped locations into the dashboard shape. */
export function mapZoneRows(
  zoneRows: ShippingZoneRow[],
  locationRows: ShippingZoneLocationRow[]
): ShippingZone[] {
  const locationsByZone = groupLocationsByZone(locationRows);
  return zoneRows.map((zone) => ({
    id: zone.id,
    name: zone.name,
    isRestOfWorld: zone.is_rest_of_world,
    active: zone.active,
    locations: locationsByZone.get(zone.id) ?? [],
  }));
}

function isPickupAddress(value: unknown): value is MerchantPickupAddress {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** `kind`/`condition_type` are DB-constrained enums; cast is safe post-fetch. */
export function mapRateRow(row: ShippingRateRow): ShippingRate {
  return {
    id: row.id,
    zoneId: row.zone_id,
    name: row.name,
    kind: row.kind as ShippingRate['kind'],
    currency: row.currency,
    baseAmount: Number(row.base_amount),
    conditionType: row.condition_type as ShippingRate['conditionType'],
    minSubtotal: row.min_subtotal === null ? null : Number(row.min_subtotal),
    maxSubtotal: row.max_subtotal === null ? null : Number(row.max_subtotal),
    freeOverAmount:
      row.free_over_amount === null ? null : Number(row.free_over_amount),
    deliveryMinDays: row.delivery_min_days,
    deliveryMaxDays: row.delivery_max_days,
    pickupAddress: isPickupAddress(row.pickup_address)
      ? row.pickup_address
      : null,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

export function mapRateRows(rows: ShippingRateRow[]): ShippingRate[] {
  return rows.map(mapRateRow);
}
