import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runImageFormatBackfill } from '@/lib/image-format-backfill';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * One-time operator CLI: check every production CDN image-transform variant
 * for format poisoning, purge the poisoned ones from Cloudflare, and re-warm
 * them with an AVIF-first Accept header. All logic lives in
 * lib/image-format-backfill.ts — this file is argv/env wiring only.
 *
 * Usage (ops ladder — run each rung before the next):
 *   pnpm --filter web backfill:image-format-cache -- --dry-run
 *   pnpm --filter web backfill:image-format-cache -- --limit 50
 *   pnpm --filter web backfill:image-format-cache
 *
 * Requires SUPABASE_* service env; CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID
 * for the purge step (the purge no-ops with a warning when missing).
 */

interface BackfillImageFormatCacheCliArgs {
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
  const summary = await runImageFormatBackfill({
    supabase: createServiceClient(),
    concurrency: args.concurrency,
    dryRun: args.dryRun,
    limit: args.limit,
  });

  console.log(JSON.stringify(summary, null, 2));

  // Hard failure ONLY when errors occurred and nothing was purged: the run
  // accomplished nothing and is safe to fix + re-run. Once purges happened,
  // per-URL errors are reported in the summary instead of failing the run.
  return summary.errored > 0 && summary.purged === 0 ? 1 : 0;
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
