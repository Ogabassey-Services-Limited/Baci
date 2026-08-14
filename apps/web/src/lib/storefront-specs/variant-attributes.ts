import { normalizeCanonicalProductCondition } from '@baci/shared/lib';

interface VariantAttributeDefinition {
  options?: unknown;
  param?: unknown;
}

interface VariantAttributeCarrier {
  attributes?: Record<string, unknown> | null;
  condition?: string | null;
}

export type VariantAttributeSource =
  | Record<string, unknown>
  | VariantAttributeDefinition[]
  | null
  | undefined;

export function canonicalizeVariantAxis(axis: string) {
  return axis
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function pushUniqueOption(
  axisOptions: Record<string, string[]>,
  axis: string,
  value: unknown
) {
  if (typeof value !== 'string') {
    return;
  }

  const trimmedValue = normalizeVariantAxisOption(axis, value);
  if (!trimmedValue) {
    return;
  }

  if (!axisOptions[axis]) {
    axisOptions[axis] = [];
  }

  if (!axisOptions[axis].includes(trimmedValue)) {
    axisOptions[axis].push(trimmedValue);
  }
}

function normalizeVariantAxisOption(axis: string, value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmedValue = value.trim();

  if (axis === 'condition') {
    return normalizeCanonicalProductCondition(trimmedValue);
  }

  return trimmedValue;
}

export function normalizeVariantAttributes(source: VariantAttributeSource) {
  const axisOptions: Record<string, string[]> = {};

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.param !== 'string'
      ) {
        continue;
      }

      const axis = canonicalizeVariantAxis(entry.param);
      if (!axis) {
        continue;
      }

      const options = Array.isArray(entry.options)
        ? entry.options
        : entry.options === undefined || entry.options === null
          ? []
          : [entry.options];

      for (const option of options) {
        pushUniqueOption(axisOptions, axis, option);
      }
    }

    return axisOptions;
  }

  if (!source || typeof source !== 'object') {
    return axisOptions;
  }

  for (const [rawAxis, options] of Object.entries(source)) {
    const axis = canonicalizeVariantAxis(rawAxis);
    if (!axis) {
      continue;
    }

    const values = Array.isArray(options) ? options : [options];
    for (const value of values) {
      pushUniqueOption(axisOptions, axis, value);
    }
  }

  return axisOptions;
}

/**
 * Convenience helper for a single-axis lookup.
 * This calls normalizeVariantAttributes on every invocation, so callers that
 * need multiple axes should call normalizeVariantAttributes once and read the
 * canonicalized keys directly after applying canonicalizeVariantAxis.
 */
export function getVariantAttributeOptions(
  source: VariantAttributeSource,
  axis: string
) {
  const normalizedAxis = canonicalizeVariantAxis(axis);
  return normalizeVariantAttributes(source)[normalizedAxis] || [];
}

function normalizeVariantAttributeRecord(
  attributes: Record<string, unknown> | null | undefined
) {
  const normalized: Record<string, string> = {};

  for (const [rawAxis, value] of Object.entries(attributes ?? {})) {
    const axis = canonicalizeVariantAxis(rawAxis);
    const normalizedValue = normalizeVariantAxisOption(axis, value);

    if (axis && normalizedValue) {
      normalized[axis] = normalizedValue;
    }
  }

  return normalized;
}

function getVariantAxisValue(
  variant: VariantAttributeCarrier,
  normalizedAttributes: Record<string, string>,
  axis: string
) {
  if (axis === 'condition') {
    return normalizeCanonicalProductCondition(variant.condition);
  }

  return normalizedAttributes[axis];
}

const NON_RENDERABLE_VARIANT_AXES = new Set([
  'color',
  'colour',
  'color_hex',
  'colour_hex',
  'availability_note',
  'availability',
  'note',
  'notes',
  'disclaimer',
  'disclaimers',
  'warranty',
  'warranty_note',
  'notice',
]);

function isRenderableVariantAxis(axis: string, options: string[]) {
  if (
    NON_RENDERABLE_VARIANT_AXES.has(axis) ||
    axis.includes('note') ||
    axis.includes('disclaimer') ||
    axis.includes('notice') ||
    axis.includes('warranty')
  ) {
    return false;
  }

  if (axis === 'condition') {
    return options.length > 1;
  }

  return options.length > 0;
}

export function mergeVariantAxisOptions(
  variants: VariantAttributeCarrier[] | null | undefined,
  source: VariantAttributeSource,
  fallbackCondition?: string | null
) {
  const axisOptions = normalizeVariantAttributes(source);
  delete axisOptions.condition;

  for (const variant of variants || []) {
    for (const [rawAxis, value] of Object.entries(variant.attributes || {})) {
      const axis = canonicalizeVariantAxis(rawAxis);
      if (!axis || axis === 'condition') {
        continue;
      }

      pushUniqueOption(axisOptions, axis, value);
    }

    pushUniqueOption(
      axisOptions,
      'condition',
      variant.condition ?? fallbackCondition
    );
  }

  return axisOptions;
}

/**
 * Returns the reachable option values for a given axis given the current
 * selections on all other axes. Used to disable impossible combinations in
 * the variant selector UI.
 */
export function getAvailableOptionsForAxis(
  axis: string,
  variants: VariantAttributeCarrier[] | null | undefined,
  currentSelections: Record<string, string>
): string[] {
  const normalizedAxis = canonicalizeVariantAxis(axis);
  const normalizedSelections = Object.fromEntries(
    Object.entries(currentSelections)
      .filter(([k]) => canonicalizeVariantAxis(k) !== normalizedAxis)
      .map(([k, v]) => {
        const selectionAxis = canonicalizeVariantAxis(k);
        return [selectionAxis, normalizeVariantAxisOption(selectionAxis, v)];
      })
      .filter(([, value]) => Boolean(value))
  );

  const reachable = new Set<string>();
  for (const variant of variants ?? []) {
    const normalizedAttributes = normalizeVariantAttributeRecord(
      variant.attributes
    );
    const matchesAll = Object.entries(normalizedSelections).every(
      ([selectionAxis, value]) =>
        getVariantAxisValue(variant, normalizedAttributes, selectionAxis) ===
        value
    );
    if (matchesAll) {
      const value = getVariantAxisValue(
        variant,
        normalizedAttributes,
        normalizedAxis
      );
      if (typeof value === 'string' && value.trim()) {
        reachable.add(value.trim());
      }
    }
  }
  return Array.from(reachable);
}

export function getRenderableVariantAxes(
  variants: VariantAttributeCarrier[] | null | undefined,
  source: VariantAttributeSource,
  fallbackCondition?: string | null
) {
  const priorityOrder = [
    'condition',
    'storage',
    'ram',
    'sim_type',
    'connectivity',
    'size',
    'platform',
  ];

  return Object.entries(
    mergeVariantAxisOptions(variants, source, fallbackCondition)
  )
    .filter(([axis, options]) => isRenderableVariantAxis(axis, options))
    .sort(([leftAxis], [rightAxis]) => {
      const leftPriority = priorityOrder.indexOf(leftAxis);
      const rightPriority = priorityOrder.indexOf(rightAxis);

      if (leftPriority !== -1 && rightPriority !== -1) {
        return leftPriority - rightPriority;
      }

      if (leftPriority !== -1) {
        return -1;
      }

      if (rightPriority !== -1) {
        return 1;
      }

      return leftAxis.localeCompare(rightAxis);
    })
    .map(([axis]) => axis);
}
