/**
 * VPS worker: cleanup-import-uploads
 * Replaces /api/cron/cleanup-import-uploads running on Vercel.
 * Runs directly against Supabase — no Vercel Fluid Compute charge.
 *
 * Required env vars (set in /home/bassey/baci-workers/.env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Crontab: 0 3 * * * /usr/bin/node /home/bassey/baci-workers/jobs/cleanup-import-uploads.mjs >> /home/bassey/baci-workers/logs/cleanup-import-uploads.log 2>&1
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url).pathname });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[cleanup-import-uploads] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const { data, error } = await supabase
  .from('pending_import_uploads')
  .select('id, merchant_id, client_upload_id, storage_path')
  .is('claimed_at', null)
  .lt('expires_at', new Date().toISOString());

if (error) {
  console.error('[cleanup-import-uploads] Query failed:', error);
  process.exit(1);
}

let cleaned = 0;

for (const upload of data ?? []) {
  const existingJob = await supabase
    .from('import_jobs')
    .select('id')
    .eq('merchant_id', upload.merchant_id)
    .eq('client_upload_id', upload.client_upload_id)
    .maybeSingle();

  if (existingJob.error) {
    console.error('[cleanup-import-uploads] Job lookup failed:', existingJob.error);
    continue;
  }

  if (existingJob.data) {
    const del = await supabase.from('pending_import_uploads').delete().eq('id', upload.id);
    if (!del.error) cleaned++;
    continue;
  }

  const storage = supabase.storage.from('migration-imports');
  const existsResult = await storage.exists(upload.storage_path);
  if (existsResult.error) {
    console.error('[cleanup-import-uploads] Existence check failed:', existsResult.error);
    continue;
  }

  if (existsResult.data) {
    const removeResult = await storage.remove([upload.storage_path]);
    if (removeResult.error) {
      console.error('[cleanup-import-uploads] Storage removal failed:', removeResult.error);
      continue;
    }
  }

  const del = await supabase.from('pending_import_uploads').delete().eq('id', upload.id);
  if (!del.error) cleaned++;
}

console.log(`[cleanup-import-uploads] Done — cleaned=${cleaned}`);
