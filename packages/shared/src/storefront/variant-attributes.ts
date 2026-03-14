export interface VariantAttributeDefinition {
  options?: unknown;
  param?: string;
}

export interface VariantAttributeCarrier {
  attributes?: Record<string, string> | null;
}

export type NormalizedVariantAttributeOptions = Record<string, string[]>;

const NON_RENDERABLE_AXES = new Set(['color', 'color_hex', 'condition']);
const PRIORITY_ORDER = [
  'storage',
  'ram',
  'sim_type',
  'connectivity',
  'size',
  'platform',
] as const;
const PRIORITY_INDEX = new Map<string, number>(
  PRIORITY_ORDER.map((axis, index) => [axis, index] as const)
);
const AXIS_LABELS: Record<string, string> = {
  color: 'Color',
  connectivity: 'Connectivity',
  platform: 'Platform',
  processor: 'Processor',
  ram: 'RAM',
  sim_type: 'SIM Type',
  size: 'Size',
  storage: 'Storage',
};

export type VariantAttributeSource =
  | Record<string, unknown>
  | VariantAttributeDefinition[]
  | null
  | undefined;
const NORMALIZED_ATTRIBUTE_OPTIONS_CACHE = new WeakMap<
  object,
  NormalizedVariantAttributeOptions
>();
// Cache keys assume callers do not mutate source objects after normalization.

export function canonicalizeVariantAxis(axis: string): string {
  return axis
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function formatVariantAxisLabel(axis: string): string {
  const normalizedAxis = canonicalizeVariantAxis(axis);

  return (
    AXIS_LABELS[normalizedAxis] ||
    (/^[a-z]{2,4}$/.test(normalizedAxis)
      ? normalizedAxis.toUpperCase()
      :
    normalizedAxis
      .split('_')
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' '))
  );
}

function pushUniqueOption(
  axisOptions: Record<string, string[]>,
  seenOptions: Map<string, Set<string>>,
  axis: string,
  value: unknown
) {
  if (typeof value !== 'string') {
    return;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return;
  }

  if (!axisOptions[axis]) {
    axisOptions[axis] = [];
  }

  let axisSeenOptions = seenOptions.get(axis);
  if (!axisSeenOptions) {
    axisSeenOptions = new Set(axisOptions[axis]);
    seenOptions.set(axis, axisSeenOptions);
  }

  if (!axisSeenOptions.has(trimmedValue)) {
    axisSeenOptions.add(trimmedValue);
    axisOptions[axis].push(trimmedValue);
  }
}

export function normalizeVariantAttributes(
  source: VariantAttributeSource
): NormalizedVariantAttributeOptions {
  const axisOptions: NormalizedVariantAttributeOptions = {};
  const seenOptions = new Map<string, Set<string>>();

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
        pushUniqueOption(axisOptions, seenOptions, axis, option);
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
      pushUniqueOption(axisOptions, seenOptions, axis, value);
    }
  }

  return axisOptions;
}

export function getVariantAttributeOptions(
  source: VariantAttributeSource,
  axis: string
): string[] {
  const normalizedAxis = canonicalizeVariantAxis(axis);

  return [...(getNormalizedVariantAttributeOptions(source)[normalizedAxis] || [])];
}

function getNormalizedVariantAttributeOptions(
  source: VariantAttributeSource
): NormalizedVariantAttributeOptions {
  if (!source || typeof source !== 'object') {
    return {};
  }

  let cachedOptions = NORMALIZED_ATTRIBUTE_OPTIONS_CACHE.get(source);
  if (cachedOptions === undefined) {
    cachedOptions = normalizeVariantAttributes(source);
    NORMALIZED_ATTRIBUTE_OPTIONS_CACHE.set(source, cachedOptions);
  }

  return cachedOptions;
}

export function mergeVariantAxisOptions(
  variants: VariantAttributeCarrier[] | null | undefined,
  source: VariantAttributeSource
): NormalizedVariantAttributeOptions {
  const axisOptions = Object.fromEntries(
    Object.entries(getNormalizedVariantAttributeOptions(source)).map(
      ([axis, options]) => [axis, [...options]]
    )
  ) as NormalizedVariantAttributeOptions;
  const seenOptions = new Map(
    Object.entries(axisOptions).map(([axis, options]) => [axis, new Set(options)])
  );

  for (const variant of variants || []) {
    for (const [rawAxis, value] of Object.entries(variant.attributes || {})) {
      const axis = canonicalizeVariantAxis(rawAxis);
      if (!axis) {
        continue;
      }

      pushUniqueOption(axisOptions, seenOptions, axis, value);
    }
  }

  return axisOptions;
}

export function getRenderableVariantAxes(
  variants: VariantAttributeCarrier[] | null | undefined,
  source: VariantAttributeSource
): string[] {
  return Object.entries(mergeVariantAxisOptions(variants, source))
    .filter(
      ([axis, options]) => options.length > 1 && !NON_RENDERABLE_AXES.has(axis)
    )
    .sort((leftEntry, rightEntry) => {
      const [leftAxis] = leftEntry;
      const [rightAxis] = rightEntry;
      const leftPriority = PRIORITY_INDEX.get(leftAxis) ?? -1;
      const rightPriority = PRIORITY_INDEX.get(rightAxis) ?? -1;

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
