import { sanitizePrice, sanitizeText, sanitizeUrl } from '@/lib/sanitize-core';
import { bumpaProductRowSchema } from '@/schemas/bumpa-products';
import type {
  ExistingImportedProduct,
  ImportPreviewRow,
  ImportPreviewSummary,
  NormalizedImportedProduct,
} from './bumpa-types';

interface BuildBumpaProductPreviewInput {
  rows: Record<string, string>[];
  existingProducts: ExistingImportedProduct[];
  chunkSize?: number;
  onProgress?: (progress: {
    processedRows: number;
    totalRows: number;
  }) => Promise<void> | void;
}

interface BuildBumpaProductPreviewChunk {
  rows: ImportPreviewRow<NormalizedImportedProduct>[];
  processedRows: number;
  totalRows: number;
  partialSummary: ImportPreviewSummary;
}

function splitImageField(value: string) {
  return value
    .split(/[|,]/)
    .map((part) => sanitizeUrl(part.trim()))
    .filter(Boolean);
}

function buildSummary(rows: ImportPreviewRow<NormalizedImportedProduct>[]) {
  return rows.reduce<ImportPreviewSummary>(
    (summary, row) => {
      summary.totalRows += 1;

      if (row.rowStatus === 'invalid') {
        summary.invalidRows += 1;
      } else {
        summary.validRows += 1;
      }

      if (row.rowStatus === 'create') summary.createCount += 1;
      if (row.rowStatus === 'update') summary.updateCount += 1;
      if (row.rowStatus === 'duplicate') summary.duplicateCount += 1;

      return summary;
    },
    {
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
    }
  );
}

async function maybeReportProgress(
  onProgress: BuildBumpaProductPreviewInput['onProgress'],
  processedRows: number,
  totalRows: number
) {
  if (!onProgress || totalRows <= 0) {
    return;
  }

  async function report() {
    try {
      await onProgress?.({ processedRows, totalRows });
    } catch {
      return;
    }
  }

  if (processedRows === totalRows || processedRows <= 10) {
    await report();
    return;
  }

  const batchSize = Math.max(10, Math.ceil(totalRows / 50));
  if (processedRows % batchSize === 0) {
    await report();
  }
}

export async function* buildBumpaProductPreviewChunks({
  rows,
  existingProducts,
  chunkSize = 250,
  onProgress,
}: BuildBumpaProductPreviewInput) {
  const effectiveChunkSize = chunkSize > 0 ? chunkSize : 250;
  const seenExternalIds = new Set<string>();
  const existingByExternalId = new Map<string, ExistingImportedProduct>();

  existingProducts.forEach((product) => {
    if (product.externalSource === 'bumpa' && product.externalId) {
      existingByExternalId.set(product.externalId, product);
    }
  });

  const previewRows: ImportPreviewRow<NormalizedImportedProduct>[] = [];
  const pendingRows = new Map<
    number,
    ImportPreviewRow<NormalizedImportedProduct>
  >();

  function queuePendingRow(row: ImportPreviewRow<NormalizedImportedProduct>) {
    pendingRows.set(row.rowNumber, row);
  }

  function buildChunk(
    processedRows: number,
    force = false
  ): BuildBumpaProductPreviewChunk | null {
    if (pendingRows.size === 0) {
      return null;
    }

    if (!force && processedRows % effectiveChunkSize !== 0) {
      return null;
    }

    const chunkRows = Array.from(pendingRows.values()).sort(
      (left, right) => left.rowNumber - right.rowNumber
    );
    pendingRows.clear();

    return {
      rows: chunkRows,
      processedRows,
      totalRows: rows.length,
      partialSummary: buildSummary(previewRows),
    };
  }

  for (const [index, rawRow] of rows.entries()) {
    const rowNumber = index + 2;
    const validationResult = bumpaProductRowSchema.safeParse(rawRow);
    if (!validationResult.success) {
      const previewRow = {
        rowNumber,
        sourceExternalId: null,
        rowStatus: 'invalid',
        errors: validationResult.error.errors.map((error) => error.message),
        payload: null,
        meta: {},
      } satisfies ImportPreviewRow<NormalizedImportedProduct>;
      previewRows.push(previewRow);
      queuePendingRow(previewRow);
      await maybeReportProgress(onProgress, index + 1, rows.length);
      const chunk = buildChunk(index + 1, index + 1 === rows.length);
      if (chunk) {
        yield chunk;
      }
      continue;
    }

    const row = validationResult.data;
    const errors: string[] = [];
    const externalSourceId = row['Product ID'] || row['Source ID'];

    if (seenExternalIds.has(externalSourceId)) {
      const previewRow = {
        rowNumber,
        sourceExternalId: externalSourceId,
        rowStatus: 'duplicate',
        errors: ['Duplicate Bumpa product id in the same file'],
        payload: null,
        meta: {},
      } satisfies ImportPreviewRow<NormalizedImportedProduct>;
      previewRows.push(previewRow);
      queuePendingRow(previewRow);
      await maybeReportProgress(onProgress, index + 1, rows.length);
      const chunk = buildChunk(index + 1, index + 1 === rows.length);
      if (chunk) {
        yield chunk;
      }
      continue;
    }

    seenExternalIds.add(externalSourceId);

    if ((row['Row Type'] || 'product').toLowerCase() !== 'product') {
      errors.push(`Unsupported Bumpa row type: ${row['Row Type']}`);
    }

    const price = sanitizePrice(row.Price);
    if (price <= 0) {
      errors.push('Price must be greater than zero');
    }

    const payload = {
      sourcePlatform: 'bumpa',
      externalSourceId,
      title: sanitizeText(row.Title),
      description: sanitizeText(row.Description) || null,
      sku: sanitizeText(row.SKU) || null,
      price,
      currency: sanitizeText(row['Currency Code']) || 'NGN',
      stock: Number.parseInt(row.Stock || '0', 10) || 0,
      manageStock: row['Manage Stock'] !== '0',
      status: row['Is Active'] === '1' ? 'active' : 'draft',
      images: [
        ...splitImageField(row['Main Image']),
        ...splitImageField(row['Additional Images']),
      ],
      category:
        sanitizeText(row['Product Type']) ||
        sanitizeText(row.Collections) ||
        null,
      sourceCreatedAt: row['Created At'] || null,
      sourceUpdatedAt: row['Updated At'] || null,
      importMetadata: {
        vendor: sanitizeText(row.Vendor) || null,
        condition: sanitizeText(row.Condition) || null,
        googleProductCategory:
          sanitizeText(row['Google Product Category']) || null,
      },
    } satisfies NormalizedImportedProduct;

    const previewRow = {
      rowNumber,
      sourceExternalId: externalSourceId,
      rowStatus:
        errors.length > 0
          ? 'invalid'
          : existingByExternalId.has(externalSourceId)
            ? 'update'
            : 'create',
      errors,
      payload: errors.length > 0 ? null : payload,
      meta: {},
    } satisfies ImportPreviewRow<NormalizedImportedProduct>;
    previewRows.push(previewRow);
    queuePendingRow(previewRow);
    await maybeReportProgress(onProgress, index + 1, rows.length);
    const chunk = buildChunk(index + 1, index + 1 === rows.length);
    if (chunk) {
      yield chunk;
    }
  }
}

export async function buildBumpaProductPreview({
  rows,
  existingProducts,
  chunkSize = 250,
  onProgress,
}: BuildBumpaProductPreviewInput) {
  const previewRows = new Map<
    number,
    ImportPreviewRow<NormalizedImportedProduct>
  >();
  let summary = buildSummary([]);

  for await (const chunk of buildBumpaProductPreviewChunks({
    rows,
    existingProducts,
    chunkSize,
    onProgress,
  })) {
    chunk.rows.forEach((row) => {
      previewRows.set(row.rowNumber, row);
    });
    summary = chunk.partialSummary;
  }

  return {
    rows: Array.from(previewRows.values()),
    summary,
  };
}
