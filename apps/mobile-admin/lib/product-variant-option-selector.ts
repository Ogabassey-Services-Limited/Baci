import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import {
  formatAttributeLabel,
  getOrderedGroupKeys,
  getVariantAttributeEntries,
  getVariantAttributeMap,
} from '@/lib/product-variant-attributes';

export interface VariantOptionValue {
  available: boolean;
  label: string;
  selected: boolean;
  value: string;
}

export interface VariantOptionGroup {
  key: string;
  label: string;
  values: VariantOptionValue[];
}

export type VariantOptionSelection = Record<string, string>;

const CAPACITY_OPTION_AXIS_KEYS = new Set([
  'capacity',
  'memory',
  'ram',
  'rom',
  'storage',
]);

const CAPACITY_UNIT_FACTORS_IN_GB: Record<string, number> = {
  gb: 1,
  kb: 1 / (1024 * 1024),
  mb: 1 / 1024,
  tb: 1024,
};

function shouldSortByCapacity(key: string): boolean {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[._\s-]+/)
    .some((segment) => CAPACITY_OPTION_AXIS_KEYS.has(segment));
}

function parseCapacityValue(value: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([kmgt]b)\s*$/i.exec(value);
  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1] ?? '');
  const unitFactor = CAPACITY_UNIT_FACTORS_IN_GB[match[2]?.toLowerCase() ?? ''];
  if (!Number.isFinite(amount) || unitFactor === undefined) {
    return null;
  }

  return amount * unitFactor;
}

function compareCapacityValues(left: string, right: string): number {
  const leftCapacity = parseCapacityValue(left);
  const rightCapacity = parseCapacityValue(right);

  if (leftCapacity !== null && rightCapacity !== null) {
    return leftCapacity === rightCapacity
      ? left.localeCompare(right, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      : leftCapacity - rightCapacity;
  }

  if (leftCapacity !== null) {
    return -1;
  }

  if (rightCapacity !== null) {
    return 1;
  }

  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function getSortedOptionValues(key: string, values: string[]): string[] {
  if (!shouldSortByCapacity(key)) {
    return values;
  }

  return [...values].sort(compareCapacityValues);
}

function variantMatchesSelection(
  variant: AdminProductVariant,
  selection: VariantOptionSelection,
  exceptKey?: string,
  knownKeys?: ReadonlySet<string>
): boolean {
  const attributeMap = getVariantAttributeMap(variant);
  return Object.entries(selection).every(([key, value]) => {
    if (key === exceptKey || !value) {
      return true;
    }

    if (!(key in attributeMap)) {
      return !knownKeys?.has(key);
    }

    return attributeMap[key] === value;
  });
}

export function buildVariantOptionGroups(
  variants: AdminProductVariant[],
  selection: VariantOptionSelection
): VariantOptionGroup[] {
  const labelsByKey = new Map<string, string>();
  const valuesByKey = new Map<string, string[]>();

  for (const variant of variants) {
    for (const entry of getVariantAttributeEntries(variant)) {
      labelsByKey.set(entry.key, entry.label);
      const values = valuesByKey.get(entry.key) ?? [];
      if (!values.includes(entry.value)) {
        values.push(entry.value);
      }
      valuesByKey.set(entry.key, values);
    }
  }

  const knownKeys = new Set(valuesByKey.keys());

  return getOrderedGroupKeys([...valuesByKey.keys()]).map((key) => ({
    key,
    label: labelsByKey.get(key) ?? formatAttributeLabel(key),
    values: getSortedOptionValues(key, valuesByKey.get(key) ?? []).map(
      (value) => ({
        available: variants.some((variant) => {
          const attributeMap = getVariantAttributeMap(variant);
          return (
            attributeMap[key] === value &&
            variantMatchesSelection(variant, selection, key, knownKeys)
          );
        }),
        label: value,
        selected: selection[key] === value,
        value,
      })
    ),
  }));
}

export function completeSingleValueSelection(
  variants: AdminProductVariant[],
  selection: VariantOptionSelection,
  initialGroups = buildVariantOptionGroups(variants, selection)
): VariantOptionSelection {
  let nextSelection = selection;
  const maxPasses = Math.max(1, initialGroups.length);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const groups =
      pass === 0
        ? initialGroups
        : buildVariantOptionGroups(variants, nextSelection);
    let changed = false;

    for (const group of groups) {
      if (nextSelection[group.key]?.trim()) {
        continue;
      }

      const availableValues = group.values.filter((value) => value.available);
      if (availableValues.length !== 1) {
        continue;
      }

      if (nextSelection === selection) {
        nextSelection = { ...selection };
      }
      nextSelection[group.key] = availableValues[0]?.value ?? '';
      changed = true;
    }

    if (!changed) {
      return nextSelection;
    }
  }

  return nextSelection;
}

export function resolveSelectedVariant(
  variants: AdminProductVariant[],
  selection: VariantOptionSelection
): AdminProductVariant | null {
  const groups = buildVariantOptionGroups(variants, selection);
  if (
    groups.length === 0 ||
    groups.some((group) => !selection[group.key]?.trim())
  ) {
    return null;
  }

  const knownKeys = new Set(groups.map((group) => group.key));
  const matches = variants.filter((variant) =>
    variantMatchesSelection(variant, selection, undefined, knownKeys)
  );

  return matches.length === 1 ? matches[0] : null;
}
