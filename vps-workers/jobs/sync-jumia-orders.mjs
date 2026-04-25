/**
 * VPS worker: sync-jumia-orders
 * Imports Jumia marketplace orders without invoking Vercel Functions.
 */

import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { syncJumiaOrdersForActiveIntegrations } from '../lib/jumia-order-sync.mjs';
import { createExpoClient } from '../lib/push.mjs';

export async function runSyncJumiaOrders({
  supabase,
  expo,
  logger = console,
  syncOrders = syncJumiaOrdersForActiveIntegrations,
}) {
  if (!supabase || !expo) {
    throw new Error('runSyncJumiaOrders requires supabase and expo clients');
  }

  const result = await syncOrders({ supabase, expo });
  if (!result || !Array.isArray(result.errors)) {
    throw new Error(`Invalid sync result: ${JSON.stringify(result)}`);
  }

  logger.log(
    `[sync-jumia-orders] Done - integrations=${result.integrations}, synced=${result.synced}, canonicalCreated=${result.canonicalCreated}, canonicalUpdated=${result.canonicalUpdated}, notified=${result.notified}, errors=${result.errors.length}`
  );

  if (result.errors.length > 0) {
    for (const syncError of result.errors) {
      logger.error('[sync-jumia-orders] error:', syncError);
    }
    throw new Error(
      `Jumia sync completed with ${result.errors.length} error(s)`
    );
  }

  return result;
}

async function main() {
  config({ path: new URL('../.env', import.meta.url).pathname });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '[sync-jumia-orders] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const expo = createExpoClient();

  try {
    await runSyncJumiaOrders({ supabase, expo });
    console.log('[sync-jumia-orders] Worker completed successfully');
  } catch (error) {
    console.error('[sync-jumia-orders] Worker failed:', error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
