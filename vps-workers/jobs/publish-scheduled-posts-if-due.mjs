/**
 * VPS worker: publish-scheduled-posts-if-due
 * Keeps the 15-minute empty scheduled-post checks off Vercel. When posts are
 * actually due, it invokes the existing web cron route so cache revalidation
 * and Zoho dispatch still run in the web runtime.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { runWebCron } from './run-web-cron.mjs';

const PUBLISH_SCHEDULED_POSTS_PATH = '/api/cron/publish-scheduled-posts';

export async function publishScheduledPostsIfDue({
  createSupabaseClient = createClient,
  env = process.env,
  logger = console,
  now = new Date(),
  runWebCronFn = runWebCron,
} = {}) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  const nowIso = now.toISOString();
  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { count, error } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .lte('published_at', nowIso);

  if (error) {
    throw new Error(`Scheduled post preflight failed: ${error.message}`);
  }

  const dueCount = count ?? 0;
  if (dueCount <= 0) {
    logger.log(
      `[publish-scheduled-posts-if-due] No due scheduled posts at ${nowIso}; skipped web cron.`
    );
    return { dueCount, invoked: false };
  }

  logger.log(
    `[publish-scheduled-posts-if-due] Found ${dueCount} due scheduled posts at ${nowIso}; invoking web cron.`
  );
  const result = await runWebCronFn({
    env,
    logger,
    path: PUBLISH_SCHEDULED_POSTS_PATH,
  });
  return { dueCount, invoked: true, result };
}

async function main() {
  config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

  try {
    await publishScheduledPostsIfDue();
  } catch (error) {
    console.error('[publish-scheduled-posts-if-due] Worker failed:', error);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
