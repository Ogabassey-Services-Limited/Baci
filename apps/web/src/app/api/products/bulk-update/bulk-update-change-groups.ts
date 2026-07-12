import type { z } from 'zod';
import type { BulkUpdateChangesSchema } from '@/schemas/dashboard-product-import-actions';

export type BulkUpdateChange = z.infer<
  typeof BulkUpdateChangesSchema
>['changes'][number];

const normalizeProductId = (productId: string) =>
  productId.trim().toLowerCase();

export function groupBulkUpdateChanges(
  changes: BulkUpdateChange[]
): BulkUpdateChange[][] {
  const hasAmbiguousExistingTarget = changes.some(
    (change) => change.type !== 'new' && !change.productId?.trim()
  );
  if (hasAmbiguousExistingTarget) {
    return [changes];
  }

  const slugGeneratingProductIds = new Set(
    changes.flatMap((change) =>
      change.type === 'update' && change.details.name?.trim()
        ? [normalizeProductId(change.productId ?? '')]
        : []
    )
  );
  const groups: BulkUpdateChange[][] = [];
  const groupByKey = new Map<string, BulkUpdateChange[]>();
  const newProductChanges: BulkUpdateChange[] = [];
  const slugSensitiveChanges: BulkUpdateChange[] = [];

  for (const change of changes) {
    if (change.type === 'new') {
      const target =
        slugGeneratingProductIds.size > 0
          ? slugSensitiveChanges
          : newProductChanges;
      target.push(change);
      continue;
    }

    const normalizedProductId = normalizeProductId(change.productId ?? '');
    if (slugGeneratingProductIds.has(normalizedProductId)) {
      slugSensitiveChanges.push(change);
      continue;
    }

    const key = `id:${normalizedProductId}`;
    const existingGroup = groupByKey.get(key);
    if (existingGroup) {
      existingGroup.push(change);
      continue;
    }

    const group = [change];
    groupByKey.set(key, group);
    groups.push(group);
  }

  if (slugSensitiveChanges.length > 0) {
    groups.push(slugSensitiveChanges);
  }
  if (newProductChanges.length > 0) {
    groups.push(newProductChanges);
  }

  return groups;
}
