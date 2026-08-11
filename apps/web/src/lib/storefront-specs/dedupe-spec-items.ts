import { getProductSchemaSpecKeyForLabel } from '@/lib/product-schema-spec-vocabulary';
import { isUnsupportedSpecValue } from './is-unsupported-spec-value';
import type { ProductSpecItem } from './spec-data';

interface DedupeSpecItemsOptions {
  omitUnsupportedValues?: boolean;
  section?: string;
}

function getCanonicalSpecLabel(label: string) {
  return (
    getProductSchemaSpecKeyForLabel(label) ||
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function getSpecItemIdentity(label: string, section?: string) {
  const normalizedSection = (section || 'General')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

  return `${normalizedSection}:${getCanonicalSpecLabel(label)}`;
}

function getSpecValueQuality(value: string) {
  if (!isUnsupportedSpecValue(value)) {
    return 2;
  }

  return ['false', 'no'].includes(value.trim().toLowerCase()) ? 1 : 0;
}

export function dedupeSpecItems(
  items: ProductSpecItem[],
  options: DedupeSpecItemsOptions = {}
): ProductSpecItem[] {
  const itemIndexes = new Map<string, number>();
  const dedupedItems: ProductSpecItem[] = [];

  for (const item of items) {
    const itemValueQuality = getSpecValueQuality(item.value);
    const unsupportedValue = itemValueQuality < 2;
    if (options.omitUnsupportedValues && unsupportedValue) {
      continue;
    }

    const identity = getSpecItemIdentity(item.label, options.section);
    const existingIndex = itemIndexes.get(identity);
    if (existingIndex === undefined) {
      itemIndexes.set(identity, dedupedItems.length);
      dedupedItems.push(item);
      continue;
    }

    const existingItem = dedupedItems[existingIndex];
    if (itemValueQuality > getSpecValueQuality(existingItem.value)) {
      dedupedItems[existingIndex] = item;
    }
  }

  return dedupedItems;
}
