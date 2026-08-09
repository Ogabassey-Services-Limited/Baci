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

function isUnknownSpecValue(value: string) {
  return value.trim().toLowerCase() === 'unknown';
}

export function dedupeSpecItems(
  items: ProductSpecItem[],
  options: DedupeSpecItemsOptions = {}
): ProductSpecItem[] {
  const labels = new Set<string>();

  return items.filter((item) => {
    if (
      options.omitUnsupportedValues &&
      (isUnsupportedSpecValue(item.value) || isUnknownSpecValue(item.value))
    ) {
      return false;
    }

    const identity = getSpecItemIdentity(item.label, options.section);
    if (labels.has(identity)) {
      return false;
    }

    labels.add(identity);
    return true;
  });
}
