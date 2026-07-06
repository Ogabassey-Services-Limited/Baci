import { purgeCloudflareUrls } from '@/lib/cloudflare-purge';
import {
  enumerateImageFormatBackfillTargets,
  type ImageFormatBackfillSupabaseClient,
} from '@/lib/image-format-backfill-enumeration';
import { PREWARM_ACCEPT_HEADER } from '@/lib/ogabassey-image-prewarm';

/**
 * One-time check → purge → re-warm backfill for format-poisoned CDN image
 * transform variants.
 *
 * Cloudflare Free cannot vary its transform cache on the Accept header, so a
 * `format=auto` variant serves whichever format its FIRST requester
 * negotiated — locked for up to a year. Roughly half the live variants were
 * first requested without an AVIF-first Accept and now serve JPEG/WebP even
 * to AVIF-capable browsers. This module HEADs every production variant with
 * the AVIF-first Accept header; any variant that does not come back
 * `image/avif` is purged via the Cloudflare API and immediately re-HEADed
 * with the same Accept — the re-warm request both re-creates the variant
 * (locking AVIF) and verifies the result in one step.
 *
 * Operator-CLI core (src/scripts/backfill-image-format-cache.ts). Contract:
 *   - Fully injectable (supabase, fetch, purge, log) for tests.
 *   - Per-URL failures NEVER throw — they are counted as `errored` and the
 *     URL is skipped (never purged on the strength of an error).
 *   - A failed Supabase enumeration query DOES throw, and it throws BEFORE
 *     any purge happens (see image-format-backfill-enumeration.ts).
 */

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 10_000;
const PROGRESS_LOG_INTERVAL = 200;
const DRY_RUN_SAMPLE_SIZE = 10;

type PurgeImpl = (
  urls: string[],
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number }
) => Promise<void>;

export interface RunImageFormatBackfillOptions {
  supabase: ImageFormatBackfillSupabaseClient;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable purge. Defaults to `purgeCloudflareUrls` (fail-open, ≤30/batch). */
  purgeImpl?: PurgeImpl;
  /** Enumerate and count only — performs ZERO HTTP requests. */
  dryRun?: boolean;
  /** Cap on active products scanned (the "sample" ops rung). */
  limit?: number;
  /** Max simultaneous in-flight HEAD requests. Defaults to 4. */
  concurrency?: number;
  /** Per-request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number;
  /** Progress logger. Defaults to `console.log`. */
  log?: (message: string) => void;
}

export interface ImageFormatBackfillSummary {
  /** Active products scanned. */
  products: number;
  /** Published blog posts scanned. */
  blogPosts: number;
  /** Unique transform-variant URLs enumerated. */
  urls: number;
  checked: number;
  healthy: number;
  poisoned: number;
  /**
   * Poisoned URLs HANDED to the purge implementation — NOT confirmed purges.
   * The default `purgeCloudflareUrls` is fail-open (missing env / API errors
   * warn and no-op), so treat `residualNonAvif` as the ground truth: an
   * unpurged variant re-checks as non-AVIF in the re-warm phase and lands
   * there. The CLI refuses to start a wet run without Cloudflare env.
   */
  purgeRequested: number;
  rewarmed: number;
  /** Purged but still not AVIF after re-warm (reported, never re-purged). */
  residualNonAvif: number;
  errored: number;
  /** First 10 enumerated URLs — dry-run only. */
  sampleUrls?: string[];
  dryRun: boolean;
}

type VariantHealth = 'errored' | 'healthy' | 'poisoned';

/**
 * HEAD `url` with the AVIF-first Accept header and classify the format the
 * cached variant actually serves. Never throws — failures are 'errored'.
 */
async function classifyVariantUrl(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<VariantHealth> {
  try {
    const response = await fetchImpl(url, {
      method: 'HEAD',
      headers: { Accept: PREWARM_ACCEPT_HEADER },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return 'errored';
    }
    const contentType = (
      response.headers.get('content-type') ?? ''
    ).toLowerCase();
    if (contentType.startsWith('image/avif')) {
      return 'healthy';
    }
    if (contentType.startsWith('image/')) {
      return 'poisoned';
    }
    // 2xx but not an image at all — something other than a cached transform
    // answered; do not purge on the strength of it.
    return 'errored';
  } catch {
    return 'errored';
  }
}

async function classifyWithConcurrency(
  urls: readonly string[],
  concurrency: number,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  onProgress: (completed: number) => void
): Promise<VariantHealth[]> {
  const results: VariantHealth[] = new Array(urls.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (nextIndex < urls.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await classifyVariantUrl(
        urls[currentIndex],
        fetchImpl,
        timeoutMs
      );
      completed += 1;
      onProgress(completed);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, urls.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Check every production transform variant, purge the format-poisoned ones,
 * and immediately re-warm (and re-verify) each purged URL with the AVIF-first
 * Accept header. See the module doc for the full contract.
 */
export async function runImageFormatBackfill(
  options: RunImageFormatBackfillOptions
): Promise<ImageFormatBackfillSummary> {
  const {
    supabase,
    fetchImpl = fetch,
    purgeImpl = purgeCloudflareUrls,
    dryRun = false,
    limit,
    concurrency = DEFAULT_CONCURRENCY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    log = console.log,
  } = options;

  // Enumerate FIRST; any query error throws here, before anything is purged.
  const targets = await enumerateImageFormatBackfillTargets(supabase, {
    limit,
  });
  const { urls } = targets;
  log(
    `Enumerated ${urls.length} variant URLs from ${targets.productCount} products and ${targets.blogPostCount} blog posts`
  );

  const summary: ImageFormatBackfillSummary = {
    products: targets.productCount,
    blogPosts: targets.blogPostCount,
    urls: urls.length,
    checked: 0,
    healthy: 0,
    poisoned: 0,
    purgeRequested: 0,
    rewarmed: 0,
    residualNonAvif: 0,
    errored: 0,
    dryRun,
  };

  if (dryRun) {
    summary.sampleUrls = urls.slice(0, DRY_RUN_SAMPLE_SIZE);
    return summary;
  }

  const healths = await classifyWithConcurrency(
    urls,
    concurrency,
    fetchImpl,
    timeoutMs,
    (completed) => {
      if (completed % PROGRESS_LOG_INTERVAL === 0) {
        log(`Checked ${completed}/${urls.length} variants`);
      }
    }
  );

  const poisonedUrls: string[] = [];
  for (const [index, health] of healths.entries()) {
    if (health === 'healthy') {
      summary.healthy += 1;
    } else if (health === 'poisoned') {
      poisonedUrls.push(urls[index]);
    } else {
      summary.errored += 1;
    }
  }
  summary.checked = urls.length;
  summary.poisoned = poisonedUrls.length;
  log(
    `Check complete: ${summary.healthy} healthy, ${summary.poisoned} poisoned, ${summary.errored} errored`
  );

  if (poisonedUrls.length > 0) {
    await purgeImpl(poisonedUrls, { fetchImpl, timeoutMs });
    summary.purgeRequested = poisonedUrls.length;

    // Re-warm + verify in one step: the AVIF-first HEAD re-creates the purged
    // variant and reports which format the fresh cache entry locked.
    const rewarmHealths = await classifyWithConcurrency(
      poisonedUrls,
      concurrency,
      fetchImpl,
      timeoutMs,
      (completed) => {
        if (completed % PROGRESS_LOG_INTERVAL === 0) {
          log(`Re-warmed ${completed}/${poisonedUrls.length} variants`);
        }
      }
    );
    for (const health of rewarmHealths) {
      if (health === 'healthy') {
        summary.rewarmed += 1;
      } else if (health === 'poisoned') {
        summary.residualNonAvif += 1;
      } else {
        summary.errored += 1;
      }
    }
    log(
      `Re-warm complete: ${summary.rewarmed} now AVIF, ${summary.residualNonAvif} residual non-AVIF`
    );
  }

  return summary;
}
