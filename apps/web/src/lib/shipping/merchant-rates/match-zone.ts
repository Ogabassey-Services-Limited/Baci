/**
 * Zone matching for merchant-configured shipping.
 *
 * Overlap resolution is "most-specific-match wins", computed (never a
 * merchant-managed priority list):
 *   - subdivision match (e.g. `NG-LA`) → specificity 2
 *   - country match (e.g. `NG`, whole country) → specificity 1
 *   - rest-of-world catch-all zone → specificity 0
 *
 * Tie-break: among zones of equal specificity the FIRST in input order wins.
 * The storefront RPC returns zones ordered by `created_at, id`, so the
 * earliest-created zone deterministically wins a tie.
 */

import type {
  MerchantShippingZone,
  MerchantShippingZoneLocation,
} from './types';

export interface ShippingDestination {
  /** ISO 3166-1 alpha-2 country code (case-insensitive). */
  countryCode: string;
  /** ISO 3166-2 subdivision code, e.g. `NG-LA` (case-insensitive). */
  subdivisionCode?: string | null;
}

const SPECIFICITY_NONE = -1;
const SPECIFICITY_REST_OF_WORLD = 0;
const SPECIFICITY_COUNTRY = 1;
const SPECIFICITY_SUBDIVISION = 2;

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/**
 * The best specificity `zone` reaches for `destination`, or SPECIFICITY_NONE
 * when the zone does not match at all.
 */
function zoneSpecificity(
  zone: MerchantShippingZone,
  zoneLocations: MerchantShippingZoneLocation[],
  destinationCountry: string,
  destinationSubdivision: string
): number {
  let best = zone.isRestOfWorld ? SPECIFICITY_REST_OF_WORLD : SPECIFICITY_NONE;

  for (const location of zoneLocations) {
    if (normalize(location.countryCode) !== destinationCountry) {
      continue;
    }

    const locationSubdivision = normalize(location.subdivisionCode);

    if (locationSubdivision === '') {
      // Whole-country entry.
      best = Math.max(best, SPECIFICITY_COUNTRY);
      continue;
    }

    if (
      destinationSubdivision !== '' &&
      locationSubdivision === destinationSubdivision
    ) {
      // Exact subdivision entry — cannot be beaten, stop early.
      return SPECIFICITY_SUBDIVISION;
    }
  }

  return best;
}

/**
 * Return the most-specific active zone that covers `destination`, or `null`
 * when no zone matches (not even a rest-of-world fallback).
 */
export function matchShippingZone(
  zones: MerchantShippingZone[],
  locations: MerchantShippingZoneLocation[],
  destination: ShippingDestination
): MerchantShippingZone | null {
  const destinationCountry = normalize(destination.countryCode);
  const destinationSubdivision = normalize(destination.subdivisionCode);

  if (destinationCountry === '') {
    return null;
  }

  // Group locations by zone once so specificity checks stay O(locations).
  const locationsByZone = new Map<string, MerchantShippingZoneLocation[]>();
  for (const location of locations) {
    const existing = locationsByZone.get(location.zoneId);
    if (existing) {
      existing.push(location);
    } else {
      locationsByZone.set(location.zoneId, [location]);
    }
  }

  let winner: MerchantShippingZone | null = null;
  let winnerSpecificity = SPECIFICITY_NONE;

  for (const zone of zones) {
    if (!zone.active) {
      continue;
    }

    const specificity = zoneSpecificity(
      zone,
      locationsByZone.get(zone.id) ?? [],
      destinationCountry,
      destinationSubdivision
    );

    // Strictly-greater keeps the first zone on ties (input order = created_at).
    if (specificity > winnerSpecificity) {
      winner = zone;
      winnerSpecificity = specificity;
    }
  }

  return winner;
}
