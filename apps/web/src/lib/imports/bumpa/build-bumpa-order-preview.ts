import { buildBumpaOrderPreviewSummary } from '@/lib/imports/bumpa/build-bumpa-order-preview-summary';
import {
  buildCustomer,
  buildItems,
  mapPaymentStatus,
  mapShippingStatus,
  parseIsoDate,
  parseMoney,
} from '@/lib/imports/bumpa/bumpa-order-preview-values';
import type {
  ExistingImportedOrder,
  ExistingImportedProduct,
  ImportPreviewRow,
  NormalizedImportedOrder,
} from '@/lib/imports/bumpa/bumpa-types';
import { sanitizeText } from '@/lib/sanitize-core';
import { bumpaOrderRowSchema } from '@/schemas/bumpa-orders';

interface BuildBumpaOrderPreviewInput {
  rows: Record<string, string>[];
  existingOrders: ExistingImportedOrder[];
  existingProducts: ExistingImportedProduct[];
  chunkSize?: number;
  onProgress?: (progress: {
    processedRows: number;
    totalRows: number;
  }) => Promise<void> | void;
}

interface BuildBumpaOrderPreviewChunk {
  rows: ImportPreviewRow<NormalizedImportedOrder>[];
  processedRows: number;
  totalRows: number;
  partialSummary: ReturnType<typeof buildBumpaOrderPreviewSummary>;
}

async function maybeReportProgress(
  onProgress: BuildBumpaOrderPreviewInput['onProgress'],
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

export async function* buildBumpaOrderPreviewChunks({
  rows,
  existingOrders,
  existingProducts,
  chunkSize = 250,
  onProgress,
}: BuildBumpaOrderPreviewInput) {
  const seenExternalIds = new Set<string>();
  const existingOrdersByExternalId = new Map<string, ExistingImportedOrder>();
  const existingOrdersByOrderNumber = new Map<
    string,
    ExistingImportedOrder[]
  >();
  const uploadedOrderPreviewIndexes = new Map<string, number[]>();

  existingOrders.forEach((order) => {
    if (order.externalSource === 'bumpa' && order.externalId) {
      existingOrdersByExternalId.set(order.externalId, order);
    }

    const collection = existingOrdersByOrderNumber.get(order.orderNumber) || [];
    collection.push(order);
    existingOrdersByOrderNumber.set(order.orderNumber, collection);
  });

  const previewRows: ImportPreviewRow<NormalizedImportedOrder>[] = [];
  const pendingRows = new Map<
    number,
    ImportPreviewRow<NormalizedImportedOrder>
  >();

  function queuePendingRow(row: ImportPreviewRow<NormalizedImportedOrder>) {
    pendingRows.set(row.rowNumber, row);
  }

  function buildChunk(
    processedRows: number,
    force = false
  ): BuildBumpaOrderPreviewChunk | null {
    if (pendingRows.size === 0) {
      return null;
    }

    if (!force && processedRows % chunkSize !== 0) {
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
      partialSummary: buildBumpaOrderPreviewSummary(previewRows),
    };
  }

  for (const [index, rawRow] of rows.entries()) {
    const rowNumber = index + 2;
    const validationResult = bumpaOrderRowSchema.safeParse(rawRow);
    if (!validationResult.success) {
      const previewRow = {
        rowNumber,
        sourceExternalId: null,
        rowStatus: 'invalid',
        errors: validationResult.error.errors.map((error) => error.message),
        payload: null,
        meta: {},
      } satisfies ImportPreviewRow<NormalizedImportedOrder>;
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
    const externalSourceId = row.id;

    if (seenExternalIds.has(externalSourceId)) {
      const previewRow = {
        rowNumber,
        sourceExternalId: externalSourceId,
        rowStatus: 'duplicate',
        errors: ['Duplicate Bumpa order id in the same file'],
        payload: null,
        meta: {},
      } satisfies ImportPreviewRow<NormalizedImportedOrder>;
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

    const orderNumber = sanitizeText(row['Order Number']);
    const existingImportedOrder =
      existingOrdersByExternalId.get(externalSourceId);
    const previousUploadIndexes =
      uploadedOrderPreviewIndexes.get(orderNumber) || [];
    const conflictingOrder = (
      existingOrdersByOrderNumber.get(orderNumber) || []
    ).find(
      (existingOrder) =>
        existingOrder.externalSource !== 'bumpa' ||
        existingOrder.externalId !== externalSourceId
    );

    if (conflictingOrder) {
      errors.push(`Order number ${orderNumber} already exists in Baci`);
    }

    const orderDate = parseIsoDate(row['Order Date']);
    const createdAt = parseIsoDate(row['Created At']);

    if (!orderDate) {
      errors.push('Order Date is invalid');
    }

    if (!createdAt) {
      errors.push('Created At is invalid');
    }

    const duplicateUploadError = `Order number ${orderNumber} is duplicated in the upload`;
    if (previousUploadIndexes.length > 0) {
      errors.push(duplicateUploadError);
    }

    const customer = buildCustomer(row);
    const items = buildItems(row, existingProducts);

    if (items.some((item) => !item.productName)) {
      errors.push('One or more imported items are missing a product name');
    }

    const paymentStatus = mapPaymentStatus(row['Payment Status']);
    const shippingStatus = mapShippingStatus(
      row.Status,
      row['Shipping Status']
    );
    const payload =
      orderDate && createdAt
        ? ({
            sourcePlatform: 'bumpa',
            externalSourceId,
            orderNumber,
            customer,
            paymentStatus,
            shippingStatus,
            sourceOrderStatus: row.Status,
            sourceShippingStatus: row['Shipping Status'] || null,
            sourceChannel: row.Channel || null,
            sourceOrigin: row.Origin || null,
            total: parseMoney(row.Total),
            subtotal: parseMoney(row['Sub Total']),
            discountAmount: parseMoney(row.Discount),
            shippingFee: parseMoney(row['Shipping Price']),
            taxAmount: parseMoney(row.Tax),
            amountPaid: parseMoney(row['Amount Paid']),
            amountDue: parseMoney(row['Amount Due']),
            currency: 'NGN',
            orderDate,
            createdAt,
            updatedAt: parseIsoDate(row['Updated At']),
            couponCode: sanitizeText(row['Coupon Code']) || null,
            shippingOption: sanitizeText(row['Shipping Option']) || null,
            receiptReady: paymentStatus === 'paid',
            items,
            importMetadata: {
              rawStatus: row.Status,
              rawShippingStatus: row['Shipping Status'],
              rawChannel: row.Channel,
              rawOrigin: row.Origin,
            },
          } satisfies NormalizedImportedOrder)
        : null;

    const previewRow = {
      rowNumber,
      sourceExternalId: externalSourceId,
      rowStatus:
        errors.length > 0
          ? 'invalid'
          : existingImportedOrder
            ? 'update'
            : 'create',
      errors,
      payload,
      meta: {
        unmatchedItemCount: items.filter((item) => !item.matched).length,
      },
    } satisfies ImportPreviewRow<NormalizedImportedOrder>;

    previewRows.push(previewRow);
    queuePendingRow(previewRow);

    if (orderNumber) {
      if (previousUploadIndexes.length > 0) {
        for (const previewIndex of previousUploadIndexes) {
          const previousPreviewRow = previewRows[previewIndex];
          if (!previousPreviewRow) {
            continue;
          }

          if (!previousPreviewRow.errors.includes(duplicateUploadError)) {
            previousPreviewRow.errors.push(duplicateUploadError);
          }

          if (previousPreviewRow.rowStatus !== 'duplicate') {
            previousPreviewRow.rowStatus = 'invalid';
          }

          queuePendingRow(previousPreviewRow);
        }
      }

      uploadedOrderPreviewIndexes.set(orderNumber, [
        ...previousUploadIndexes,
        previewRows.length - 1,
      ]);
    }

    await maybeReportProgress(onProgress, index + 1, rows.length);
    const chunk = buildChunk(index + 1, index + 1 === rows.length);
    if (chunk) {
      yield chunk;
    }
  }
}

export async function buildBumpaOrderPreview({
  rows,
  existingOrders,
  existingProducts,
  chunkSize = 250,
  onProgress,
}: BuildBumpaOrderPreviewInput) {
  const previewRows = new Map<
    number,
    ImportPreviewRow<NormalizedImportedOrder>
  >();
  let summary = buildBumpaOrderPreviewSummary([]);

  for await (const chunk of buildBumpaOrderPreviewChunks({
    rows,
    existingOrders,
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
    rows: Array.from(previewRows.values()).sort(
      (left, right) => left.rowNumber - right.rowNumber
    ),
    summary,
  };
}
