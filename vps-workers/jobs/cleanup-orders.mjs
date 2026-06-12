/**
 * VPS worker: cleanup-orders
 * Runs the abandoned-order cleanup RPC directly on the VPS instead of calling
 * the CRON_SECRET-gated web route.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const DEFAULT_HOURS_THRESHOLD = 72;

function readHoursThreshold(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_HOURS_THRESHOLD;
}

export async function cleanupOrders({
  createSupabaseClient = createClient,
  env = process.env,
  logger = console,
} = {}) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  const hoursThreshold = readHoursThreshold(env.CLEANUP_ORDERS_HOURS_THRESHOLD);
  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.rpc('mark_abandoned_orders', {
    hours_threshold: hoursThreshold,
  });

  if (error) {
    throw new Error(`Order cleanup failed: ${error.message}`);
  }

  logger.log(
    `[cleanup-orders] Done - marked abandoned orders older than ${hoursThreshold} hours`
  );
  return { hoursThreshold };
}

async function main() {
  config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

  try {
    await cleanupOrders();
  } catch (error) {
    console.error('[cleanup-orders] Worker failed:', error);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
