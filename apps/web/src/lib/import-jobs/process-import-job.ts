import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';
import { runClaimedImportJob } from '@/lib/import-jobs/run-claimed-import-job';
import { logger } from '@/lib/logger';

const HIGH_PRIORITY_QUEUE_STATUSES = [
  'commit_queued',
  'notify_queued',
] as const;
const UPLOADED_QUEUE_RESERVED_SLOTS = 1;
const CLAIMED_STATUS_MAP = {
  uploaded: 'validating',
  commit_queued: 'committing',
  notify_queued: 'notifying',
} as const;

const IMPORT_JOB_SELECT =
  'id, merchant_id, created_by, source_platform, entity_type, status, original_filename, storage_path, content_type, file_size_bytes, total_rows, processed_rows, summary, error, started_at, created_at, committed_at, notified_at, completed_at';

async function loadQueuedJobsForStatus(
  supabase: SupabaseClient,
  status: keyof typeof CLAIMED_STATUS_MAP,
  limit: number
) {
  if (limit <= 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('import_jobs')
    .select(IMPORT_JOB_SELECT)
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to load queued import jobs for status ${status}: ${error.message}`
    );
  }

  return (data || []) as ImportJobRecord[];
}

async function claimQueuedJob(
  supabase: SupabaseClient,
  queuedJob: ImportJobRecord
) {
  const claimedStatus =
    CLAIMED_STATUS_MAP[queuedJob.status as keyof typeof CLAIMED_STATUS_MAP];
  if (!claimedStatus) {
    return null;
  }

  const { data: claimedJob, error: claimError } = await supabase
    .from('import_jobs')
    .update({
      status: claimedStatus,
      started_at: new Date().toISOString(),
    })
    .eq('id', queuedJob.id)
    .eq('status', queuedJob.status)
    .select(IMPORT_JOB_SELECT)
    .single();

  if (claimError || !claimedJob) {
    logger.info({
      message: 'Skipping import job that could not be claimed',
      jobId: queuedJob.id,
      claimError: claimError?.message || null,
    });
    return null;
  }

  return claimedJob as ImportJobRecord;
}

export async function processImportJobQueue(
  supabase: SupabaseClient,
  limit = 5
) {
  const jobs: ImportJobRecord[] = [];
  const uploadedReserve = limit > 1 ? UPLOADED_QUEUE_RESERVED_SLOTS : 0;
  let highPriorityRemaining = Math.max(limit - uploadedReserve, 0);

  for (const status of HIGH_PRIORITY_QUEUE_STATUSES) {
    if (highPriorityRemaining <= 0) {
      break;
    }

    const highPriorityJobs = await loadQueuedJobsForStatus(
      supabase,
      status,
      highPriorityRemaining
    );
    jobs.push(...highPriorityJobs);
    highPriorityRemaining -= highPriorityJobs.length;
  }

  // Keep preview generation moving even under sustained commit/notify backlog.
  jobs.push(
    ...(await loadQueuedJobsForStatus(
      supabase,
      'uploaded',
      limit - jobs.length
    ))
  );

  if (jobs.length === 0) {
    return [];
  }

  const results: Record<string, unknown>[] = [];

  for (const queuedJob of jobs) {
    const claimedJob = await claimQueuedJob(supabase, queuedJob);
    if (!claimedJob) {
      continue;
    }

    results.push(await runClaimedImportJob(supabase, claimedJob));
  }

  return results;
}

export async function processImportJobById(
  supabase: SupabaseClient,
  jobId: string
) {
  const { data, error } = await supabase
    .from('import_jobs')
    .select(IMPORT_JOB_SELECT)
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load import job: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const claimedJob = await claimQueuedJob(supabase, data as ImportJobRecord);
  if (!claimedJob) {
    return null;
  }

  return await runClaimedImportJob(supabase, claimedJob);
}
