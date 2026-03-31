import type { SupabaseClient } from '@supabase/supabase-js';
import { getImportJobWorkerSecret } from '@/env';
import { buildBumpaOrderPreviewChunks } from '@/lib/imports/bumpa/build-bumpa-order-preview';
import { buildBumpaProductPreviewChunks } from '@/lib/imports/bumpa/build-bumpa-product-preview';
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

export interface PendingImportUploadRecord {
  id: string;
  merchant_id: string;
  created_by: string;
  client_upload_id: string;
  storage_path: string;
  source_platform: 'bumpa';
  entity_type: ImportJobEntityType;
  original_filename: string;
  content_type: string | null;
  file_size_bytes: number | null;
  claimed_at: string | null;
  expires_at: string;
  created_at?: string;
}

interface PreviewBuildResult {
  sourceRows: Record<string, string>[];
  rows: ImportPreviewRow<NormalizedImportedOrder | NormalizedImportedProduct>[];
  summary: ImportPreviewSummary;
  totalRows: number;
}

export interface PreviewBuildChunk {
  sourceRows: Record<string, string>[];
  rows: ImportPreviewRow<NormalizedImportedOrder | NormalizedImportedProduct>[];
  partialSummary: ImportPreviewSummary;
  processedRows: number;
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
  return validateImportFileMetadata({
    fileName: file.name,
    fileSizeBytes: file.size,
    contentType: file.type || null,
  });
}

export function validateImportFileMetadata({
  contentType,
  fileName,
  fileSizeBytes,
}: {
  fileName: string;
  fileSizeBytes: number;
  contentType?: string | null;
}) {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return 'Only CSV files are supported';
  }

  if (fileSizeBytes > IMPORT_FILE_SIZE_LIMIT_BYTES) {
    return 'CSV file exceeds the 25MB upload limit';
  }

  if (contentType && !IMPORT_FILE_MIME_TYPES.has(contentType)) {
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

async function prepareImportPreviewBuild(
  supabase: SupabaseClient,
  job: Pick<ImportJobRecord, 'entity_type' | 'merchant_id' | 'storage_path'>
) {
  const [orders, products, fileText] = await Promise.all([
    job.entity_type === 'orders'
      ? loadExistingOrders(supabase, job.merchant_id)
      : Promise.resolve([]),
    loadExistingProducts(supabase, job.merchant_id),
    readImportFileText(supabase, job.storage_path),
  ]);

  return {
    orders,
    products,
    rawRows: parseCsvText(fileText).rows,
  };
}

function createEmptyPreviewSummary(): ImportPreviewSummary {
  return {
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    createCount: 0,
    updateCount: 0,
    duplicateCount: 0,
    claimableCustomers: 0,
    phoneOnlyCustomers: 0,
    anonymousCustomers: 0,
    unmatchedItems: 0,
    receiptReadyOrders: 0,
  };
}

export async function* buildImportPreviewChunksForJob(
  supabase: SupabaseClient,
  job: Pick<ImportJobRecord, 'entity_type' | 'merchant_id' | 'storage_path'>,
  onProgress?: (progress: PreviewBuildProgress) => Promise<void> | void
): AsyncGenerator<PreviewBuildChunk> {
  const { orders, products, rawRows } = await prepareImportPreviewBuild(
    supabase,
    job
  );

  await onProgress?.({
    processedRows: 0,
    totalRows: rawRows.length,
  });

  if (job.entity_type === 'orders') {
    for await (const chunk of buildBumpaOrderPreviewChunks({
      rows: rawRows,
      existingOrders: orders,
      existingProducts: products,
      onProgress,
    })) {
      yield {
        sourceRows: rawRows,
        rows: chunk.rows,
        partialSummary: chunk.partialSummary,
        processedRows: chunk.processedRows,
        totalRows: chunk.totalRows,
      };
    }
    return;
  }

  for await (const chunk of buildBumpaProductPreviewChunks({
    rows: rawRows,
    existingProducts: products,
    onProgress,
  })) {
    yield {
      sourceRows: rawRows,
      rows: chunk.rows,
      partialSummary: chunk.partialSummary,
      processedRows: chunk.processedRows,
      totalRows: chunk.totalRows,
    };
  }
}

export async function buildImportPreviewForJob(
  supabase: SupabaseClient,
  job: Pick<ImportJobRecord, 'entity_type' | 'merchant_id' | 'storage_path'>,
  onProgress?: (progress: PreviewBuildProgress) => Promise<void> | void
): Promise<PreviewBuildResult> {
  const previewRows = new Map<
    number,
    ImportPreviewRow<NormalizedImportedOrder | NormalizedImportedProduct>
  >();
  let sourceRows: Record<string, string>[] = [];
  let totalRows = 0;
  let summary = createEmptyPreviewSummary();

  for await (const chunk of buildImportPreviewChunksForJob(
    supabase,
    job,
    onProgress
  )) {
    sourceRows = chunk.sourceRows;
    totalRows = chunk.totalRows;
    chunk.rows.forEach((row) => {
      previewRows.set(row.rowNumber, row);
    });
    summary = chunk.partialSummary;
  }

  return {
    sourceRows,
    rows: Array.from(previewRows.values()).sort(
      (left, right) => left.rowNumber - right.rowNumber
    ),
    summary,
    totalRows,
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
