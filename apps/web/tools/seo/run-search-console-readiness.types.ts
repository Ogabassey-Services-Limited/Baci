/** Crawlability audit result for one platform or merchant surface. */
export interface CrawlSurfaceAudit {
  /** Canonical origin audited for this surface. */
  readonly origin: string;
  /** Human-readable issue messages recorded during the audit. */
  readonly issues: readonly string[];
  /** Surface type used to distinguish platform and merchant checks. */
  readonly kind: 'platform' | 'merchant';
  /** Whether the audited surface passed all readiness checks. */
  readonly passed: boolean;
  /** Sitemap URLs declared by the audited surface. */
  readonly sitemaps: readonly string[];
}

/** Aggregate readiness result across platform and merchant surfaces. */
export interface SearchConsoleReadinessResult {
  /** Overall pass state across every audited surface. */
  readonly passed: boolean;
  /** Per-surface audit results included in the readiness report. */
  readonly surfaces: readonly CrawlSurfaceAudit[];
}
