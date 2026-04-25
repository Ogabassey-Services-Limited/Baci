/**
 * Counters and recoverable errors returned by one Jumia order sync pass.
 */
export interface JumiaOrderSyncResult {
  /** Active marketplace integrations inspected during this run. */
  integrations: number;
  /** Jumia orders fetched and processed across all enabled integrations. */
  synced: number;
  /** Baci canonical order rows created from Jumia orders. */
  canonicalCreated: number;
  /** Existing Baci canonical order rows updated from Jumia orders. */
  canonicalUpdated: number;
  /** Merchant push notifications successfully sent for synced Jumia orders. */
  notified: number;
  /** Per-integration recoverable error messages captured without aborting the run. */
  errors: string[];
}
