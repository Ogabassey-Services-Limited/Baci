/**
 * VPS worker: cleanup-push-tokens
 * Replaces /api/cron/cleanup-push-tokens running on Vercel.
 * Runs directly against Supabase — no Vercel Fluid Compute charge.
 *
 * Required env vars (set in /home/bassey/baci-workers/.env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Crontab: 0 0 * * * /usr/bin/node /home/bassey/baci-workers/jobs/cleanup-push-tokens.mjs >> /home/bassey/baci-workers/logs/cleanup-push-tokens.log 2>&1
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[cleanup-push-tokens] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const [staleResult, attemptsResult] = await Promise.all([
  supabase.rpc('cleanup_stale_push_tokens'),
  supabase.rpc('cleanup_old_push_attempts'),
]);

if (staleResult.error) {
  console.error('[cleanup-push-tokens] Stale tokens cleanup failed:', staleResult.error);
}
if (attemptsResult.error) {
  console.error('[cleanup-push-tokens] Old attempts cleanup failed:', attemptsResult.error);
}

if (staleResult.error || attemptsResult.error) {
  process.exit(1);
}

console.log(`[cleanup-push-tokens] Done — cleanedTokens=${staleResult.data ?? 0}, cleanedAttempts=${attemptsResult.data ?? 0}`);
