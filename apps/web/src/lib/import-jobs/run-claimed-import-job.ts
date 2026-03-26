import type { SupabaseClient } from '@supabase/supabase-js';
import { commitBumpaOrders } from '@/lib/import-commit/commit-bumpa-orders';
import { commitBumpaProducts } from '@/lib/import-commit/commit-bumpa-products';
import { createPreviewProgressReporter } from '@/lib/import-jobs/create-preview-progress-reporter';
import {
  buildImportJobRowInserts,
  buildImportPreviewForJob,
  type ImportJobRecord,
  mergeImportJobSummary,
} from '@/lib/import-jobs/import-job-service';
import { sendImportNotificationCampaign } from '@/lib/import-notifications/send-import-notification-campaign';
import type {
  NormalizedImportedOrder,
  NormalizedImportedProduct,
} from '@/lib/imports/bumpa/bumpa-types';
import { logger } from '@/lib/logger';

function isOrderPayload(value: unknown): value is NormalizedImportedOrder {
  return (
    !!value &&
    typeof value === 'object' &&
    'externalSourceId' in value &&
    'customer' in value &&
    'items' in value
  );
}

function isProductPayload(value: unknown): value is NormalizedImportedProduct {
  return (
    !!value &&
    typeof value === 'object' &&
    'externalSourceId' in value &&
    'title' in value &&
    'price' in value
  );
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack || null,
    };
  }

  return {
    message: String(error),
    stack: null,
  };
}

async function updateJobFailure(
  supabase: SupabaseClient,
  jobId: string,
  error: unknown
) {
  const errorDetails = toErrorDetails(error);
  const { error: updateError } = await supabase
    .from('import_jobs')
    .update({
      status: 'failed',
      error: errorDetails.message,
      error_details: errorDetails,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (updateError) {
    logger.error({
      message: 'Failed to persist import job failure state',
      jobId,
      error: updateError,
    });
  }
}

async function processValidatingJob(
  supabase: SupabaseClient,
  job: ImportJobRecord
) {
  const reportPreviewProgress = createPreviewProgressReporter(
    supabase,
    job,
    logger
  );
  const preview = await buildImportPreviewForJob(
    supabase,
    job,
    reportPreviewProgress
  );
  const insertRows = buildImportJobRowInserts(
    job.id,
    job.merchant_id,
    preview.sourceRows,
    preview.rows
  );

  const { error: deleteError } = await supabase
    .from('import_job_rows')
    .delete()
    .eq('import_job_id', job.id);

  if (deleteError) {
    throw new Error(
      `Failed to reset import preview rows: ${deleteError.message}`
    );
  }

  for (const chunk of chunkArray(insertRows, 250)) {
    const { error } = await supabase.from('import_job_rows').insert(chunk);
    if (error) {
      throw new Error(`Failed to save import preview rows: ${error.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from('import_jobs')
    .update({
      status: 'preview_ready',
      total_rows: preview.totalRows,
      // processed_rows reflects validated input rows for the UI progress bar,
      // so it should use preview.totalRows instead of preview.rows.length.
      processed_rows: preview.totalRows,
      summary: preview.summary,
      error: null,
      error_details: null,
    })
    .eq('id', job.id);

  if (updateError) {
    throw new Error(
      `Failed to finalize import preview: ${updateError.message}`
    );
  }

  return {
    id: job.id,
    status: 'preview_ready',
    // processed reports the preview entries generated for downstream work,
    // which can differ from processed_rows / preview.totalRows.
    processed: preview.rows.length,
  };
}

async function processCommittingJob(
  supabase: SupabaseClient,
  job: ImportJobRecord
) {
  const { data, error } = await supabase
    .from('import_job_rows')
    .select('normalized_payload')
    .eq('import_job_id', job.id)
    .in('row_status', ['create', 'update'])
    .not('normalized_payload', 'is', null)
    .order('row_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load import commit rows: ${error.message}`);
  }

  const summary =
    job.entity_type === 'orders'
      ? await commitBumpaOrders({
          supabase,
          merchantId: job.merchant_id,
          importJobId: job.id,
          orders: (data || [])
            .map((row) => row.normalized_payload)
            .filter(isOrderPayload),
        })
      : await commitBumpaProducts({
          supabase,
          merchantId: job.merchant_id,
          importJobId: job.id,
          products: (data || [])
            .map((row) => row.normalized_payload)
            .filter(isProductPayload),
        });

  const { error: updateError } = await supabase
    .from('import_jobs')
    .update({
      status: 'committed',
      committed_at: new Date().toISOString(),
      summary: mergeImportJobSummary(job.summary, summary),
      error: null,
      error_details: null,
    })
    .eq('id', job.id);

  if (updateError) {
    throw new Error(
      `Failed to update import commit summary: ${updateError.message}`
    );
  }

  return {
    id: job.id,
    status: 'committed',
    processed: Array.isArray(data) ? data.length : 0,
  };
}

async function processNotifyingJob(
  supabase: SupabaseClient,
  job: ImportJobRecord
) {
  if (job.entity_type !== 'orders') {
    throw new Error('Only order import jobs can notify customers');
  }

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select(
      'id, slug, business_name, custom_domain, support_email, email_sender_name, email'
    )
    .eq('id', job.merchant_id)
    .single();

  if (merchantError || !merchant) {
    throw new Error(
      `Failed to load merchant notification settings: ${merchantError?.message}`
    );
  }

  const { data: featureSettings, error: featureSettingsError } = await supabase
    .from('merchant_feature_settings')
    .select('custom_settings')
    .eq('merchant_id', job.merchant_id)
    .maybeSingle();

  if (featureSettingsError) {
    throw new Error(
      `Failed to load merchant feature settings: ${featureSettingsError.message}`
    );
  }

  const summary = await sendImportNotificationCampaign({
    supabase,
    importJobId: job.id,
    merchant,
    customSettings:
      (featureSettings?.custom_settings as Record<string, unknown> | null) ||
      null,
  });

  const { error: updateError } = await supabase
    .from('import_jobs')
    .update({
      status: 'completed',
      notified_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      summary: mergeImportJobSummary(job.summary, summary),
      error: null,
      error_details: null,
    })
    .eq('id', job.id);

  if (updateError) {
    throw new Error(
      `Failed to finalize notification job: ${updateError.message}`
    );
  }

  return {
    id: job.id,
    status: 'completed',
    processed: summary.sentCount,
  };
}

export async function runClaimedImportJob(
  supabase: SupabaseClient,
  job: ImportJobRecord
) {
  try {
    if (job.status === 'validating') {
      return await processValidatingJob(supabase, job);
    }

    if (job.status === 'committing') {
      return await processCommittingJob(supabase, job);
    }

    if (job.status === 'notifying') {
      return await processNotifyingJob(supabase, job);
    }

    return {
      id: job.id,
      status: job.status,
      processed: 0,
    };
  } catch (error) {
    logger.error({
      message: 'Import job failed',
      jobId: job.id,
      error,
    });
    await updateJobFailure(supabase, job.id, error);
    return {
      id: job.id,
      status: 'failed',
      processed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
