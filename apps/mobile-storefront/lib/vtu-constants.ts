// Cache freshness window for biller lists, in milliseconds.
// Provider packages and nested bill items can change between releases, so we
// re-fetch after 5 minutes.
export const BILLER_STALE_TIME = 5 * 60 * 1000;

// Cache retention window for biller queries, in milliseconds.
// Keep cached data for 24 hours after a query becomes inactive so revisiting a
// bill category is instant on the second tap.
export const BILLER_GC_TIME = 24 * 60 * 60 * 1000;
