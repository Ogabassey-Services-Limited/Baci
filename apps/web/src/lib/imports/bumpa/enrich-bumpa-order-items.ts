import { buildBumpaItemImportMetadata } from '@/lib/imports/bumpa/build-bumpa-item-import-metadata';
import type { NormalizedImportedOrderItem } from '@/lib/imports/bumpa/bumpa-types';

export function enrichBumpaOrderItems(items: NormalizedImportedOrderItem[]) {
  return items.map((item) => ({
    ...item,
    importMetadata: {
      ...(item.importMetadata ?? {}),
      bumpa: buildBumpaItemImportMetadata(item.productName),
    },
  }));
}
