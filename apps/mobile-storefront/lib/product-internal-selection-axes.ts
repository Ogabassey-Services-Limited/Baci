export const INTERNAL_SELECTION_AXIS_VALUES = [
  'color',
  'colour',
  'storage',
  'color_hex',
  'colour_hex',
] as const;

export const INTERNAL_SELECTION_AXES = new Set<string>(
  INTERNAL_SELECTION_AXIS_VALUES
);

export function isInternalSelectionAxis(axis: unknown): boolean {
  if (typeof axis !== 'string') {
    return false;
  }

  return INTERNAL_SELECTION_AXES.has(axis);
}

export function stripInternalSelectionAxes<T>(
  attributes: Record<string, T> | null | undefined
): Record<string, T> {
  if (!attributes) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes).filter(
      ([axis]) => !isInternalSelectionAxis(axis)
    )
  );
}
