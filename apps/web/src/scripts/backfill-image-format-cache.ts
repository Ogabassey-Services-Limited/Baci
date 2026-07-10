import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getCloudflareApiToken, getCloudflareZoneId } from '@/env';
import { runImageFormatBackfill } from '@/lib/image-format-backfill';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * One-time operator CLI: check every production CDN image-transform variant
 * for format poisoning, purge the poisoned ones from Cloudflare, and re-warm
 * them with an AVIF-first Accept header. All logic lives in
 * lib/image-format-backfill.ts — this file is argv/env wiring only.
 *
 * Usage (ops ladder — run each rung before the next):
 *   pnpm --filter @baci/web backfill:image-format-cache --dry-run
 *   pnpm --filter @baci/web backfill:image-format-cache --limit 50 --blog-limit 50
 *   pnpm --filter @baci/web backfill:image-format-cache
 *
 * Requires SUPABASE_* service env; CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID
 * for the purge step (the purge no-ops with a warning when missing).
 */

interface BackfillImageFormatCacheCliArgs {
  blogLimit?: number;
  concurrency?: number;
  dryRun: boolean;
  limit?: number;
}

function parsePositiveInteger(raw: string | undefined, flag: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} requires a positive integer, got: ${raw ?? '(missing)'}`);
  }
  return value;
}

function parseArgs(argv: string[]): BackfillImageFormatCacheCliArgs {
  const args: BackfillImageFormatCacheCliArgs = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--limit') {
      index += 1;
      args.limit = parsePositiveInteger(argv[index], '--limit');
    } else if (flag === '--blog-limit') {
      index += 1;
      args.blogLimit = parsePositiveInteger(argv[index], '--blog-limit');
    } else if (flag === '--concurrency') {
      index += 1;
      args.concurrency = parsePositiveInteger(argv[index], '--concurrency');
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

export async function runBackfillImageFormatCacheCli(
  argv: string[] = process.argv.slice(2)
): Promise<number> {
  const args = parseArgs(argv);

  // The default purge is fail-open (warn + no-op on missing env) — right for
  // fire-and-forget revalidation, wrong for a one-shot operator run whose
  // whole job is the purge. Refuse a wet run outright instead of reporting a
  // purgeRequested count that purged nothing.
  if (!args.dryRun && (!getCloudflareApiToken() || !getCloudflareZoneId())) {
    console.error(
      'CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required for a wet run (the purge would silently no-op without them). Set them or use --dry-run.'
    );
    return 1;
  }
  const summary = await runImageFormatBackfill({
    supabase: createServiceClient(),
    blogLimit: args.blogLimit,
    concurrency: args.concurrency,
    dryRun: args.dryRun,
    limit: args.limit,
  });

  console.log(JSON.stringify(summary, null, 2));

  // Two hard-failure modes, both safe to fix + re-run (the run is
  // idempotent): (a) errors occurred and no purge was even requested — the
  // run accomplished nothing; (b) variants remained non-AVIF after their
  // purge + re-warm — residualNonAvif is the ground truth that the purge
  // did not actually evict (fail-open helper, CF hiccup, bad creds), and a
  // "successful" exit would mask still-poisoned variants.
  if (summary.residualNonAvif > 0) {
    return 1;
  }
  return summary.errored > 0 && summary.purgeRequested === 0 ? 1 : 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runBackfillImageFormatCacheCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.stack || error.message : error
      );
      process.exitCode = 1;
    });
}
