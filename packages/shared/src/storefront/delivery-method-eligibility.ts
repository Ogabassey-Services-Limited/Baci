/**
 * Delivery-method eligibility, shared by the web and mobile storefronts so the
 * two can't drift.
 *
 * The store ships from Lagos:
 * - Door delivery: always available.
 * - Pickup at the store: only for customers in Lagos.
 * - Airport (air-cargo) delivery: only for non-Lagos states that have an
 *   airport (the list below).
 *
 * Callers map these primitives onto their own delivery-method identifiers
 * (web uses `pickup`; mobile uses `pickup_station`).
 */

/** Nigerian states (incl. FCT) with an airport that supports air-cargo delivery. */
export const AIRPORT_DELIVERY_STATES = [
  'Abuja',
  'FCT',
  'Federal Capital Territory',
  'FCT - Abuja',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Edo',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kwara',
  'Niger',
  'Ondo',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
] as const;

function normalizeState(state?: string | null): string {
  return (state ?? '').trim().toLowerCase();
}

/** True only for Lagos (the store location), where in-store pickup is offered. */
export function isPickupEligible(state?: string | null): boolean {
  return normalizeState(state) === 'lagos';
}

/**
 * True for a non-Lagos state that has an airport. Returns false when no state
 * is selected yet, so the option only appears once the address is known.
 */
export function isAirportDeliveryEligible(state?: string | null): boolean {
  const normalized = normalizeState(state);
  if (!normalized || normalized === 'lagos') {
    return false;
  }
  return AIRPORT_DELIVERY_STATES.some(
    (candidate) => candidate.toLowerCase() === normalized
  );
}
