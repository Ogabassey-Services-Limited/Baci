const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_RETENTION_DAYS = 30;
const TERMINAL_IMPORT_STATUSES = [
  'preview_ready',
  'failed',
  'committed',
  'completed',
];

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildCutoffIso(now, retentionDays) {
  return new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  ).toISOString();
}

function emptyResult() {
  return {
    deletedImportRows: 0,
    deletedPendingUploads: 0,
    expiredPreviewJobs: 0,
    removedStorageObjects: 0,
    scannedJobs: 0,
  };
}

async function expectNoError(result, message) {
  if (result?.error) {
    throw new Error(`${message}: ${result.error.message || result.error}`);
  }
  return result;
}

async function expirePreviewJobs({ supabase, jobs, now }) {
  const previewJobIds = jobs
    .filter((job) => job.status === 'preview_ready')
    .map((job) => job.id);

  if (previewJobIds.length === 0) {
    return 0;
  }

  const result = await supabase
    .from('import_jobs')
    .update(
      {
        status: 'failed',
        error: 'Import preview expired after retention cleanup',
        error_details: {
          cleaned_at: now.toISOString(),
          previous_status: 'preview_ready',
          reason: 'retention_cleanup',
        },
        completed_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { count: 'exact' }
    )
    .in('id', previewJobIds);

  await expectNoError(result, 'Failed to expire stale import previews');
  return result.count ?? previewJobIds.length;
}

async function deleteImportRows({ supabase, jobIds }) {
  if (jobIds.length === 0) {
    return 0;
  }

  const result = await supabase
    .from('import_job_rows')
    .delete({ count: 'exact' })
    .in('import_job_id', jobIds);

  await expectNoError(result, 'Failed to delete stale import preview rows');
  return result.count ?? 0;
}

async function deletePendingUploadRows({ supabase, jobs }) {
  let deleted = 0;

  for (const job of jobs) {
    if (!job.client_upload_id) {
      continue;
    }

    const result = await supabase
      .from('pending_import_uploads')
      .delete({ count: 'exact' })
      .eq('merchant_id', job.merchant_id)
      .eq('client_upload_id', job.client_upload_id);

    await expectNoError(
      result,
      'Failed to delete stale pending import upload row'
    );
    deleted += result.count ?? 0;
  }

  return deleted;
}

async function removeStorageObjects({ supabase, jobs }) {
  const paths = [
    ...new Set(
      jobs
        .map((job) => job.storage_path)
        .filter((path) => typeof path === 'string' && path.length > 0)
    ),
  ];

  if (paths.length === 0) {
    return 0;
  }

  const result = await supabase.storage.from('migration-imports').remove(paths);
  await expectNoError(result, 'Failed to remove stale migration import files');
  return paths.length;
}

export function resolveImportRetentionDays(env = process.env) {
  return toPositiveInteger(
    env.IMPORT_JOB_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS
  );
}

export async function cleanupStaleImportJobs({
  logger = console,
  now = new Date(),
  pageSize = DEFAULT_PAGE_SIZE,
  retentionDays = DEFAULT_RETENTION_DAYS,
  supabase,
}) {
  const result = emptyResult();
  const cutoffIso = buildCutoffIso(now, retentionDays);
  let lastId = '';

  while (true) {
    let query = supabase
      .from('import_jobs')
      .select('id, merchant_id, client_upload_id, storage_path, status')
      .in('status', TERMINAL_IMPORT_STATUSES)
      .lt('updated_at', cutoffIso);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    query = query.order('id', { ascending: true }).limit(pageSize);

    const { data, error } = await query;
    if (error) {
      throw new Error(
        `Failed to load stale terminal import jobs: ${error.message}`
      );
    }

    const jobs = data ?? [];
    if (jobs.length === 0) {
      break;
    }

    lastId = jobs[jobs.length - 1].id;
    result.scannedJobs += jobs.length;

    result.expiredPreviewJobs += await expirePreviewJobs({
      supabase,
      jobs,
      now,
    });
    result.deletedImportRows += await deleteImportRows({
      supabase,
      jobIds: jobs.map((job) => job.id),
    });
    result.removedStorageObjects += await removeStorageObjects({
      supabase,
      jobs,
    });
    result.deletedPendingUploads += await deletePendingUploadRows({
      supabase,
      jobs,
    });

    if (jobs.length < pageSize) {
      break;
    }
  }

  logger.info?.(
    `[cleanup-import-uploads] stale import cleanup scanned=${result.scannedJobs} expired=${result.expiredPreviewJobs} rows=${result.deletedImportRows} files=${result.removedStorageObjects} pending=${result.deletedPendingUploads}`
  );

  return result;
}
