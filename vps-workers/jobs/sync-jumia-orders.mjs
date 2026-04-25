/**
 * VPS worker: sync-jumia-orders
 * Imports Jumia marketplace orders without invoking Vercel Functions.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { syncJumiaOrdersForActiveIntegrations } from '../lib/jumia-order-sync.mjs';
import { createExpoClient } from '../lib/push.mjs';

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
  const result = await syncJumiaOrdersForActiveIntegrations({ supabase, expo });
  if (!result || !Array.isArray(result.errors)) {
    console.error('[sync-jumia-orders] Invalid sync result:', result);
    process.exit(1);
  }

  console.log(
    `[sync-jumia-orders] Done - integrations=${result.integrations}, synced=${result.synced}, canonicalCreated=${result.canonicalCreated}, canonicalUpdated=${result.canonicalUpdated}, notified=${result.notified}, errors=${result.errors.length}`
  );
  if (result.errors.length > 0) {
    for (const syncError of result.errors) {
      console.error('[sync-jumia-orders] error:', syncError);
    }
    process.exit(1);
  }
} catch (error) {
  console.error('[sync-jumia-orders] Worker failed:', error);
  process.exit(1);
}
