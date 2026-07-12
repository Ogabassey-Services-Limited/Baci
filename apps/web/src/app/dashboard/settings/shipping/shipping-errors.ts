/**
 * Typed errors for the rest-of-world zone guard.
 *
 * The rest-of-world zone is DB-created (trigger on merchant insert, backfilled
 * for existing merchants) and is NOT protected at the database layer — its
 * deletion is deliberately left unconstrained so `ON DELETE CASCADE` keeps
 * working (see `docs/shipping/merchant-shipping-rates-plan.md`, Wave-1a
 * handoff notes). This dashboard is therefore the only place that enforces
 * "never delete it, never attach locations to it, never create a second one."
 */

export class RestOfWorldZoneDeleteError extends Error {
  constructor() {
    super(
      'The "Everywhere else" zone is your delivery fallback and cannot be deleted.'
    );
    this.name = 'RestOfWorldZoneDeleteError';
  }
}

export class RestOfWorldZoneLocationsError extends Error {
  constructor() {
    super(
      'The "Everywhere else" zone matches any destination and cannot have specific locations assigned to it.'
    );
    this.name = 'RestOfWorldZoneLocationsError';
  }
}

export class ShippingZoneNotFoundError extends Error {
  constructor() {
    super('Zone not found');
    this.name = 'ShippingZoneNotFoundError';
  }
}

/**
 * A rate mutation (update, delete, toggle) matched no row for this merchant —
 * the id is stale or belongs to another store. Distinct from
 * `ShippingZoneNotFoundError`: a missing RATE is not a missing ZONE. Without
 * this, a `.update()/.delete()` filtered by id + merchant_id that affects zero
 * rows would still return `{ success: true }` and the dashboard would show a
 * success toast while nothing changed.
 */
export class ShippingRateNotFoundError extends Error {
  constructor() {
    super('Rate not found');
    this.name = 'ShippingRateNotFoundError';
  }
}

/**
 * A submitted location duplicates one already covered by another of the
 * merchant's zones. Two zones may not both claim the same country-wide row or
 * the same specific subdivision, because zone selection would then be
 * arbitrary. (Country-wide vs. a specific subdivision is NOT a conflict — that
 * is the legitimate most-specific-wins layering.)
 */
export class ShippingZoneLocationOverlapError extends Error {
  /** The other zone's display name, surfaced in the dashboard error toast. */
  readonly conflictingZoneName: string;

  constructor(conflictingZoneName: string) {
    super(
      `This location is already covered by your "${conflictingZoneName}" zone. Remove it there first, or edit that zone instead.`
    );
    this.name = 'ShippingZoneLocationOverlapError';
    this.conflictingZoneName = conflictingZoneName;
  }
}

/**
 * A zone's location set could not be replaced. Because this dashboard has no
 * DB transaction around the delete-then-insert, the action snapshots the prior
 * rows and best-effort restores them on an insert failure; this error signals
 * the caller that the save did not apply. `dataRetained` is true when the prior
 * locations were successfully restored (the zone is unchanged) and false when
 * even the restore failed (the zone may have lost its locations).
 */
export class ZoneLocationReplaceError extends Error {
  readonly dataRetained: boolean;

  constructor(dataRetained: boolean) {
    super(
      dataRetained
        ? 'We could not update this zone’s locations, so your previous locations were kept. Please try again.'
        : 'We could not update this zone’s locations and some may need to be re-entered. Please review this zone.'
    );
    this.name = 'ZoneLocationReplaceError';
    this.dataRetained = dataRetained;
  }
}
