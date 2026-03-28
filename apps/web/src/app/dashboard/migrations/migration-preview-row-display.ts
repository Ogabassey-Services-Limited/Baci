import type {
  ImportJobRowsResponse,
  ImportJobSourcePayload,
} from '@/app/dashboard/migrations/migration-types';
import type {
  NormalizedImportedOrder,
  NormalizedImportedProduct,
} from '@/lib/imports/bumpa/bumpa-types';

type MigrationPreviewRow = ImportJobRowsResponse['rows'][number];

function isNormalizedImportedOrder(
  payload: NormalizedImportedOrder | NormalizedImportedProduct | null
): payload is NormalizedImportedOrder {
  return Boolean(payload && 'orderNumber' in payload && 'customer' in payload);
}

function getSourcePayloadValue(
  sourcePayload: ImportJobSourcePayload | null | undefined,
  key: string
) {
  const value = sourcePayload?.[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatOrderInvalidSecondaryText(
  sourcePayload: ImportJobSourcePayload
) {
  const total = getSourcePayloadValue(sourcePayload, 'Total');
  const email = getSourcePayloadValue(sourcePayload, 'Customer Email');
  const phone = getSourcePayloadValue(sourcePayload, 'Customer Phone');
  const details = [total ? `${total} NGN` : null, email || phone].filter(
    Boolean
  );

  return details.length > 0
    ? details.join(' · ')
    : 'Validation errors require review';
}

export function getMigrationRowRecordText(
  entityType: 'orders' | 'products',
  row: MigrationPreviewRow
) {
  const payload = row.normalized_payload;

  if (!payload) {
    const fallbackKey =
      entityType === 'orders'
        ? getSourcePayloadValue(row.source_payload, 'Order Number')
        : getSourcePayloadValue(row.source_payload, 'Products');

    return fallbackKey || `CSV Row ${row.row_number}`;
  }

  if (entityType === 'orders') {
    if (!isNormalizedImportedOrder(payload)) {
      return `CSV Row ${row.row_number}`;
    }

    return payload.orderNumber || `CSV Row ${row.row_number}`;
  }

  if (isNormalizedImportedOrder(payload)) {
    return `CSV Row ${row.row_number}`;
  }

  return payload.title || payload.sku || `CSV Row ${row.row_number}`;
}

export function getMigrationRowPrimaryText(
  entityType: 'orders' | 'products',
  row: MigrationPreviewRow
) {
  const payload = row.normalized_payload;

  if (!payload) {
    if (entityType === 'orders') {
      return (
        getSourcePayloadValue(row.source_payload, 'Customer Name') ||
        'Validation errors require review'
      );
    }

    return (
      getSourcePayloadValue(row.source_payload, 'Products') ||
      'Validation errors require review'
    );
  }

  if (entityType === 'orders') {
    if (!isNormalizedImportedOrder(payload)) {
      return 'Unknown customer';
    }

    return payload.customer.fullName || 'Unknown customer';
  }

  if (isNormalizedImportedOrder(payload)) {
    return 'Untitled product';
  }

  return `${payload.title || 'Untitled product'}${payload.sku ? ` · ${payload.sku}` : ''}`;
}

export function getMigrationRowSecondaryText(
  entityType: 'orders' | 'products',
  row: MigrationPreviewRow
) {
  const payload = row.normalized_payload;

  if (!payload) {
    return entityType === 'orders'
      ? formatOrderInvalidSecondaryText(row.source_payload)
      : 'Validation errors require review';
  }

  if (entityType === 'orders') {
    if (!isNormalizedImportedOrder(payload)) {
      return 'Validation errors require review';
    }

    const items = payload.items.length;
    const unmatched = Number(row.meta.unmatchedItemCount || 0);
    const itemLabel = items === 1 ? 'item' : 'items';
    return `${payload.total || 0} ${payload.currency || 'NGN'} · ${items} ${itemLabel}${unmatched > 0 ? ` · ${unmatched} unmatched` : ''}`;
  }

  if (isNormalizedImportedOrder(payload)) {
    return 'Validation errors require review';
  }

  return `${payload.price || 0} ${payload.currency || 'NGN'} · ${payload.status || 'draft'}`;
}

export function getMigrationRowSourceDetails(
  entityType: 'orders' | 'products',
  row: MigrationPreviewRow
) {
  if (entityType !== 'orders') {
    return null;
  }

  if (isNormalizedImportedOrder(row.normalized_payload)) {
    return {
      sourceChannel: row.normalized_payload.sourceChannel,
      sourceOrigin: row.normalized_payload.sourceOrigin,
    };
  }

  const sourceChannel = getSourcePayloadValue(row.source_payload, 'Channel');
  const sourceOrigin = getSourcePayloadValue(row.source_payload, 'Origin');

  if (!sourceChannel && !sourceOrigin) {
    return null;
  }

  return { sourceChannel, sourceOrigin };
}
