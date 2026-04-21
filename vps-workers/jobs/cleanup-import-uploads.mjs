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

const PAGE_SIZE = 500;
let cleaned = 0;
const expiresAt = new Date().toISOString();
let lastId = '';

// Use an ID cursor so rows that fail cleanup are not re-fetched endlessly.
// Each page starts after the last-seen ID, guaranteeing forward progress.
while (true) {
  let query = supabase
    .from('pending_import_uploads')
    .select('id, merchant_id, client_upload_id, storage_path')
    .is('claimed_at', null)
    .lt('expires_at', expiresAt)
    .order('id', { ascending: true })
    .limit(PAGE_SIZE);

  if (lastId) {
    query = query.gt('id', lastId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[cleanup-import-uploads] Query failed:', error);
    process.exit(1);
  }

  const batch = data ?? [];
  if (batch.length === 0) break;

  lastId = batch[batch.length - 1].id;

  // Batch-fetch all matching import_jobs in one query to avoid N+1 round-trips.
  // Scope by both merchant_id and client_upload_id — the unique key is the
  // composite (merchant_id, client_upload_id), not client_upload_id alone.
  const clientUploadIds = batch.map((u) => u.client_upload_id);
  const merchantIds = [...new Set(batch.map((u) => u.merchant_id))];
  const { data: existingJobs, error: jobsError } = await supabase
    .from('import_jobs')
    .select('merchant_id, client_upload_id')
    .in('merchant_id', merchantIds)
    .in('client_upload_id', clientUploadIds);
  if (jobsError) {
    console.error('[cleanup-import-uploads] Batch job lookup failed:', jobsError);
    process.exit(1);
  }
  const claimedKeys = new Set(
    existingJobs?.map((j) => `${j.merchant_id}:${j.client_upload_id}`) ?? []
  );

  for (const upload of batch) {
    if (claimedKeys.has(`${upload.merchant_id}:${upload.client_upload_id}`)) {
      const del = await supabase.from('pending_import_uploads').delete().eq('id', upload.id);
      if (del.error) {
        console.error('[cleanup-import-uploads] Delete failed:', del.error);
      } else {
        cleaned++;
      }
      continue;
    }

    const storage = supabase.storage.from('migration-imports');
    const removeResult = await storage.remove([upload.storage_path]);
    if (removeResult.error) {
      console.error('[cleanup-import-uploads] Storage removal failed:', removeResult.error);
      continue;
    }

    const del = await supabase.from('pending_import_uploads').delete().eq('id', upload.id);
    if (del.error) {
      console.error('[cleanup-import-uploads] Delete failed:', del.error);
    } else {
      cleaned++;
    }
  }

  if (batch.length < PAGE_SIZE) break;
}

console.log(`[cleanup-import-uploads] Done — cleaned=${cleaned}`);
