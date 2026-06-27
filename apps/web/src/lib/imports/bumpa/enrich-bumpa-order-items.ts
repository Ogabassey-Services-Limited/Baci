import { buildBumpaItemImportMetadata } from '@/lib/imports/bumpa/build-bumpa-item-import-metadata';
import type { NormalizedImportedOrderItem } from '@/lib/imports/bumpa/bumpa-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function enrichBumpaOrderItems(items: NormalizedImportedOrderItem[]) {
  return items.map((item) => ({
    ...item,
    importMetadata: {
      ...(item.importMetadata ?? {}),
      bumpa: isRecord(item.importMetadata?.bumpa)
        ? item.importMetadata.bumpa
        : buildBumpaItemImportMetadata(item.productName),
    },
  }));
}
