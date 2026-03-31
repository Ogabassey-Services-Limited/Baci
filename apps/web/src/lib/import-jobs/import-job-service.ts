import type { SupabaseClient } from '@supabase/supabase-js';
import { getImportJobWorkerSecret } from '@/env';
import { buildBumpaOrderPreview } from '@/lib/imports/bumpa/build-bumpa-order-preview';
import { buildBumpaProductPreview } from '@/lib/imports/bumpa/build-bumpa-product-preview';
import type {
  ExistingImportedOrder,
  ExistingImportedProduct,
  ImportPreviewRow,
  ImportPreviewSummary,
  NormalizedImportedOrder,
  NormalizedImportedProduct,
} from '@/lib/imports/bumpa/bumpa-types';
import { parseCsvText } from '@/lib/imports/csv/parse-csv';
import { logger } from '@/lib/logger';
import type {
  ImportJobEntityType,
  ImportJobStatus,
} from '@/schemas/import-jobs';

const IMPORT_FILE_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
]);

export const IMPORT_FILE_SIZE_LIMIT_BYTES = 25 * 1024 * 1024;

export interface ImportJobRecord {
  id: string;
  merchant_id: string;
  created_by: string;
  source_platform: 'bumpa';
  entity_type: ImportJobEntityType;
  status: ImportJobStatus;
  original_filename: string;
  storage_path: string;
  content_type: string | null;
  file_size_bytes: number | null;
  total_rows: number;
  processed_rows: number;
  summary: Record<string, unknown> | null;
  error: string | null;
  started_at?: string | null;
  created_at: string;
  committed_at?: string | null;
  notified_at?: string | null;
  completed_at?: string | null;
}

interface PreviewBuildResult {
  sourceRows: Record<string, string>[];
  rows: ImportPreviewRow<NormalizedImportedOrder | NormalizedImportedProduct>[];
  summary: ImportPreviewSummary;
  totalRows: number;
}

interface PreviewBuildProgress {
  processedRows: number;
  totalRows: number;
}

interface ImportJobRowInsert {
  import_job_id: string;
  merchant_id: string;
  row_number: number;
  source_external_id: string | null;
  row_status: 'create' | 'update' | 'duplicate' | 'invalid';
  source_payload: Record<string, string>;
  normalized_payload:
    | NormalizedImportedOrder
    | NormalizedImportedProduct
    | null;
  validation_errors: string[];
  meta: Record<string, unknown>;
}

function getSourceRowIndex(rowNumber: number) {
  return rowNumber - 2;
}

export function canManageImportJob(
  entityType: ImportJobEntityType,
  hasPermission: (resource: string, action: string) => boolean
) {
  if (hasPermission('settings', 'edit')) {
    return true;
  }

  if (entityType === 'orders') {
    return hasPermission('orders', 'edit');
  }

  return hasPermission('products', 'create');
}

export function createImportStoragePath(
  merchantId: string,
  entityType: ImportJobEntityType,
  originalFilename: string
) {
  const safeFilename = originalFilename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = safeFilename || `${entityType}.csv`;

  return `${merchantId}/${entityType}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
}

export function validateImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'Only CSV files are supported';
  }

  if (file.size > IMPORT_FILE_SIZE_LIMIT_BYTES) {
    return 'CSV file exceeds the 25MB upload limit';
  }

  if (file.type && !IMPORT_FILE_MIME_TYPES.has(file.type)) {
    return 'Unsupported CSV content type';
  }

  return null;
}

export async function readImportFileText(
  supabase: SupabaseClient,
  storagePath: string
) {
  const { data, error } = await supabase.storage
    .from('migration-imports')
    .download(storagePath);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to download import file');
  }

  return await data.text();
}

async function loadExistingOrders(
  supabase: SupabaseClient,
  merchantId: string
) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, external_source, external_id')
    .eq('merchant_id', merchantId);

  if (error) {
    throw new Error(`Failed to load existing orders: ${error.message}`);
  }

  return (data || []).map(
    (order) =>
      ({
        id: order.id,
        orderNumber: order.order_number,
        externalSource: order.external_source,
        externalId: order.external_id,
      }) satisfies ExistingImportedOrder
  );
}

async function loadExistingProducts(
  supabase: SupabaseClient,
  merchantId: string
) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, price, external_source, external_id')
    .eq('merchant_id', merchantId);

  if (error) {
    throw new Error(`Failed to load existing products: ${error.message}`);
  }

  return (data || []).map(
    (product) =>
      ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price:
          typeof product.price === 'number'
            ? product.price
            : Number(product.price),
        externalSource: product.external_source,
        externalId: product.external_id,
      }) satisfies ExistingImportedProduct
  );
}

export async function buildImportPreviewForJob(
  supabase: SupabaseClient,
  job: Pick<ImportJobRecord, 'entity_type' | 'merchant_id' | 'storage_path'>,
  onProgress?: (progress: PreviewBuildProgress) => Promise<void> | void
): Promise<PreviewBuildResult> {
  const [orders, products, fileText] = await Promise.all([
    loadExistingOrders(supabase, job.merchant_id),
    loadExistingProducts(supabase, job.merchant_id),
    readImportFileText(supabase, job.storage_path),
  ]);

  const rawRows = parseCsvText(fileText).rows;
  await onProgress?.({
    processedRows: 0,
    totalRows: rawRows.length,
  });

  if (job.entity_type === 'orders') {
    const preview = await buildBumpaOrderPreview({
      rows: rawRows,
      existingOrders: orders,
      existingProducts: products,
      onProgress,
    });

    return {
      sourceRows: rawRows,
      rows: preview.rows,
      summary: preview.summary,
      totalRows: rawRows.length,
    };
  }

  const preview = await buildBumpaProductPreview({
    rows: rawRows,
    existingProducts: products,
    onProgress,
  });

  return {
    sourceRows: rawRows,
    rows: preview.rows,
    summary: preview.summary,
    totalRows: rawRows.length,
  };
}

export function buildImportJobRowInserts(
  jobId: string,
  merchantId: string,
  sourceRows: Record<string, string>[],
  previewRows: ImportPreviewRow<
    NormalizedImportedOrder | NormalizedImportedProduct
  >[]
) {
  return previewRows.map(
    (row): ImportJobRowInsert => ({
      import_job_id: jobId,
      merchant_id: merchantId,
      row_number: row.rowNumber,
      source_external_id: row.sourceExternalId,
      row_status: row.rowStatus,
      source_payload: sourceRows[getSourceRowIndex(row.rowNumber)] || {},
      normalized_payload: row.payload,
      validation_errors: row.errors,
      meta: row.meta,
    })
  );
}

export async function triggerImportWorker(origin: string, jobId?: string) {
  const workerSecret = getImportJobWorkerSecret();

  if (!workerSecret) {
    return;
  }

  const response = await fetch(`${origin}/api/import-jobs/worker`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      ...(jobId ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(jobId ? { body: JSON.stringify({ jobId }) } : {}),
    cache: 'no-store',
  }).catch((error) => {
    logger.error({
      message: 'Failed to trigger import worker',
      error,
      origin,
      jobId,
    });

    throw error;
  });

  if (response.ok) {
    return;
  }

  const responseBody = await response.text().catch(() => null);
  logger.error({
    message: 'Import worker trigger returned non-OK response',
    origin,
    jobId,
    status: response.status,
    statusText: response.statusText,
    body: responseBody,
  });

  throw new Error(
    `Import worker trigger failed: ${response.status} ${response.statusText}`
  );
}

export function mergeImportJobSummary(
  currentSummary: Record<string, unknown> | null | undefined,
  updates: object
): Record<string, unknown> {
  return {
    ...(currentSummary || {}),
    ...updates,
  };
}
