import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';
import { runClaimedImportJob } from '@/lib/import-jobs/run-claimed-import-job';

const QUEUED_STATUSES = ['uploaded', 'commit_queued', 'notify_queued'] as const;
const CLAIMED_STATUS_MAP = {
  uploaded: 'validating',
  commit_queued: 'committing',
  notify_queued: 'notifying',
} as const;

export async function processImportJobQueue(
  supabase: SupabaseClient,
  limit = 5
) {
  const { data, error } = await supabase
    .from('import_jobs')
    .select(
      'id, merchant_id, created_by, source_platform, entity_type, status, original_filename, storage_path, content_type, file_size_bytes, total_rows, processed_rows, summary, error, created_at, committed_at, notified_at, completed_at'
    )
    .in('status', [...QUEUED_STATUSES])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load queued import jobs: ${error.message}`);
  }

  const jobs = (data || []) as ImportJobRecord[];
  if (jobs.length === 0) {
    return [];
  }

  const results: Record<string, unknown>[] = [];

  for (const queuedJob of jobs) {
    const claimedStatus =
      CLAIMED_STATUS_MAP[queuedJob.status as keyof typeof CLAIMED_STATUS_MAP];
    if (!claimedStatus) {
      continue;
    }

    const { data: claimedJob, error: claimError } = await supabase
      .from('import_jobs')
      .update({
        status: claimedStatus,
        started_at: new Date().toISOString(),
      })
      .eq('id', queuedJob.id)
      .eq('status', queuedJob.status)
      .select(
        'id, merchant_id, created_by, source_platform, entity_type, status, original_filename, storage_path, content_type, file_size_bytes, total_rows, processed_rows, summary, error, started_at, created_at, committed_at, notified_at, completed_at'
      )
      .single();

    if (claimError || !claimedJob) {
      continue;
    }

    results.push(
      await runClaimedImportJob(supabase, claimedJob as ImportJobRecord)
    );
  }

  return results;
}
