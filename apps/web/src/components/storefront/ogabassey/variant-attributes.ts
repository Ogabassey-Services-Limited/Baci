interface VariantAttributeDefinition {
  options?: unknown;
  param?: unknown;
}

interface VariantAttributeCarrier {
  attributes?: Record<string, string> | null;
}

export type VariantAttributeSource =
  | Record<string, unknown>
  | VariantAttributeDefinition[]
  | null
  | undefined;

export function canonicalizeVariantAxis(axis: string) {
  return axis.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function pushUniqueOption(
  axisOptions: Record<string, string[]>,
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

  if (!axisOptions[axis].includes(trimmedValue)) {
    axisOptions[axis].push(trimmedValue);
  }
}

export function normalizeVariantAttributes(source: VariantAttributeSource) {
  const axisOptions: Record<string, string[]> = {};

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (!entry || typeof entry !== 'object' || typeof entry.param !== 'string') {
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

export function mergeVariantAxisOptions(
  variants: VariantAttributeCarrier[] | null | undefined,
  source: VariantAttributeSource
) {
  const axisOptions = normalizeVariantAttributes(source);

  for (const variant of variants || []) {
    for (const [rawAxis, value] of Object.entries(variant.attributes || {})) {
      const axis = canonicalizeVariantAxis(rawAxis);
      if (!axis) {
        continue;
      }

      pushUniqueOption(axisOptions, axis, value);
    }
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
  currentSelections: Record<string, string>,
): string[] {
  const normalizedAxis = canonicalizeVariantAxis(axis);
  const normalizedSelections = Object.fromEntries(
    Object.entries(currentSelections)
      .filter(([k]) => canonicalizeVariantAxis(k) !== normalizedAxis)
      .map(([k, v]) => [canonicalizeVariantAxis(k), v]),
  );

  const reachable = new Set<string>();
  for (const variant of variants ?? []) {
    const attrs = variant.attributes ?? {};
    const matchesAll = Object.entries(normalizedSelections).every(
      ([k, v]) => attrs[k] === v,
    );
    if (matchesAll) {
      const value = attrs[normalizedAxis];
      if (typeof value === 'string' && value.trim()) {
        reachable.add(value.trim());
      }
    }
  }
  return Array.from(reachable);
}

export function getRenderableVariantAxes(
  variants: VariantAttributeCarrier[] | null | undefined,
  source: VariantAttributeSource
) {
  const nonRenderableAxes = new Set(['color', 'color_hex', 'condition']);
  const priorityOrder = [
    'storage',
    'ram',
    'sim_type',
    'connectivity',
    'size',
    'platform',
  ];

  return Object.entries(mergeVariantAxisOptions(variants, source))
    .filter(
      ([axis, options]) =>
        options.length > 1 && !nonRenderableAxes.has(axis)
    )
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
