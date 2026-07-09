import { formatProductCondition } from '@/lib/product-condition';
import {
  buildVariantAttributeRecord,
  type EditableProductVariant,
} from '@/lib/product-variant-form';
import {
  isColorAttributeKey,
  isMetaAttributeKey,
} from '@/lib/variant-attribute-display';

export interface VariantAxis {
  /** 'condition' or 'attr:<lowercased key>' */
  id: string;
  /** Display name, e.g. 'Condition' or 'Storage' */
  label: string;
  isCondition: boolean;
  /** Original-case attribute key for attribute axes */
  attributeKey?: string;
  /** Distinct raw values (lowercase) in first-seen order */
  values: string[];
  /** Display label per raw value */
  valueLabels: Record<string, string>;
}

export interface VariantPricingGroup {
  key: string;
  label: string;
  indexes: number[];
  /** Shared value across the group, or null when members disagree */
  commonPrice: number | null;
  commonCostPrice: number | null;
}

export interface VariantPricingUpdate {
  indexes: number[];
  price?: number;
  cost_price?: number;
}

export type VariantFilterSelection = Record<string, string | null>;

function buildLowercaseAttributeRecord(
  variant: EditableProductVariant
): Record<string, string> {
  const record = buildVariantAttributeRecord(variant.attributes);
  const lowered: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!isMetaAttributeKey(key)) {
      lowered[key.toLowerCase()] = value;
    }
  }
  return lowered;
}

/**
 * The dimensions a variant set varies along: condition (when used) plus every
 * visible attribute key. Drives the bulk-pricing sheet and the list filters.
 */
export function getVariantAxes(
  variants: EditableProductVariant[]
): VariantAxis[] {
  const axes: VariantAxis[] = [];

  const conditionAxis: VariantAxis = {
    id: 'condition',
    isCondition: true,
    label: 'Condition',
    valueLabels: {},
    values: [],
  };
  for (const variant of variants) {
    const raw = variant.condition?.trim().toLowerCase();
    if (raw && !conditionAxis.values.includes(raw)) {
      conditionAxis.values.push(raw);
      conditionAxis.valueLabels[raw] =
        formatProductCondition(variant.condition) ?? raw;
    }
  }
  if (conditionAxis.values.length > 0) {
    axes.push(conditionAxis);
  }

  const attributeAxes = new Map<string, VariantAxis>();
  for (const variant of variants) {
    const record = buildVariantAttributeRecord(variant.attributes);
    for (const [key, value] of Object.entries(record)) {
      if (isMetaAttributeKey(key)) {
        continue;
      }
      const loweredKey = key.toLowerCase();
      let axis = attributeAxes.get(loweredKey);
      if (!axis) {
        axis = {
          attributeKey: key,
          id: `attr:${loweredKey}`,
          isCondition: false,
          label: key,
          valueLabels: {},
          values: [],
        };
        attributeAxes.set(loweredKey, axis);
        axes.push(axis);
      }
      const rawValue = value.toLowerCase();
      if (!axis.values.includes(rawValue)) {
        axis.values.push(rawValue);
        axis.valueLabels[rawValue] = value;
      }
    }
  }

  return axes;
}

export function isColorAxis(axis: VariantAxis): boolean {
  return Boolean(axis.attributeKey && isColorAttributeKey(axis.attributeKey));
}

/**
 * Default axis selection for bulk pricing: everything except colour, since
 * colour rarely drives price. Falls back to all axes when only colour exists.
 */
export function getDefaultPricingAxisIds(axes: VariantAxis[]): string[] {
  const nonColor = axes.filter((axis) => !isColorAxis(axis));
  return (nonColor.length > 0 ? nonColor : axes).map((axis) => axis.id);
}

/** Raw (lowercase) value a variant has for an axis, or '' when absent. */
export function getAxisRawValue(
  variant: EditableProductVariant,
  axis: VariantAxis
): string {
  if (axis.isCondition) {
    return variant.condition?.trim().toLowerCase() ?? '';
  }
  const record = buildLowercaseAttributeRecord(variant);
  return (
    record[axis.attributeKey?.toLowerCase() ?? '']?.toLowerCase() ?? ''
  );
}

/**
 * One row per distinct combination of the selected axes, with the price the
 * group's members share (or null when they disagree — shown as "Mixed").
 */
export function buildVariantPricingGroups(
  variants: EditableProductVariant[],
  axes: VariantAxis[]
): VariantPricingGroup[] {
  const groups = new Map<string, VariantPricingGroup>();

  variants.forEach((variant, index) => {
    const rawValues = axes.map((axis) => getAxisRawValue(variant, axis));
    const key = rawValues.join('|');
    const label =
      axes
        .map(
          (axis, axisIndex) =>
            axis.valueLabels[rawValues[axisIndex]] ??
            (rawValues[axisIndex] || '—')
        )
        .join(' · ') || 'All variants';

    let group = groups.get(key);
    if (!group) {
      group = {
        commonCostPrice: variant.cost_price,
        commonPrice: variant.price,
        indexes: [],
        key,
        label,
      };
      groups.set(key, group);
    }
    group.indexes.push(index);
    if (group.commonPrice !== variant.price) {
      group.commonPrice = null;
    }
    if (group.commonCostPrice !== variant.cost_price) {
      group.commonCostPrice = null;
    }
  });

  return Array.from(groups.values());
}

/**
 * Variants that should share pricing with the one at `index`: same condition
 * and same visible attributes apart from colour. E.g. every other colour of
 * "Used · 128GB".
 */
export function getSimilarVariantIndexes(
  variants: EditableProductVariant[],
  index: number
): number[] {
  const target = variants[index];
  if (!target) {
    return [];
  }

  const signature = (variant: EditableProductVariant) => {
    const record = buildLowercaseAttributeRecord(variant);
    const parts = Object.entries(record)
      .filter(([key]) => !isColorAttributeKey(key))
      .map(([key, value]) => `${key}=${value.toLowerCase()}`)
      .sort()
      .join('|');
    return `${variant.condition?.trim().toLowerCase() ?? ''}::${parts}`;
  };

  const targetSignature = signature(target);
  const similar: number[] = [];
  variants.forEach((variant, variantIndex) => {
    if (variantIndex !== index && signature(variant) === targetSignature) {
      similar.push(variantIndex);
    }
  });
  return similar;
}

/** Indexes of the variants matching every active filter (one value per axis). */
export function filterVariantIndexes(
  variants: EditableProductVariant[],
  axes: VariantAxis[],
  selection: VariantFilterSelection
): number[] {
  const active = axes.filter((axis) => selection[axis.id]);
  return variants
    .map((_, index) => index)
    .filter((index) =>
      active.every(
        (axis) => getAxisRawValue(variants[index], axis) === selection[axis.id]
      )
    );
}

export function pruneVariantFilterSelection(
  selection: VariantFilterSelection,
  axes: VariantAxis[]
): VariantFilterSelection {
  const next: VariantFilterSelection = {};
  for (const axis of axes) {
    const selectedValue = selection[axis.id];
    if (selectedValue && axis.values.includes(selectedValue)) {
      next[axis.id] = selectedValue;
    }
  }
  return next;
}

export function areVariantFilterSelectionsEqual(
  left: VariantFilterSelection,
  right: VariantFilterSelection
): boolean {
  const activeLeft = Object.entries(left).filter(([, value]) => Boolean(value));
  const activeRight = Object.entries(right).filter(([, value]) => Boolean(value));
  if (activeLeft.length !== activeRight.length) {
    return false;
  }

  return activeLeft.every(([axisId, value]) => right[axisId] === value);
}

/** Pure fan-out of pricing edits onto their target variants. */
export function applyPricingUpdates(
  variants: EditableProductVariant[],
  updates: VariantPricingUpdate[]
): EditableProductVariant[] {
  const byIndex = new Map<number, { cost_price?: number; price?: number }>();
  for (const update of updates) {
    for (const index of update.indexes) {
      const existing = byIndex.get(index) ?? {};
      if (update.price !== undefined) {
        existing.price = update.price;
      }
      if (update.cost_price !== undefined) {
        existing.cost_price = update.cost_price;
      }
      byIndex.set(index, existing);
    }
  }

  return variants.map((variant, index) => {
    const pricing = byIndex.get(index);
    return pricing ? { ...variant, ...pricing } : variant;
  });
}
