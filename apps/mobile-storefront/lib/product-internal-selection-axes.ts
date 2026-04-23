const INTERNAL_SELECTION_AXIS_VALUES = [
  'color',
  'colour',
  'storage',
  'color_hex',
  'colour_hex',
] as const;

export const INTERNAL_SELECTION_AXES = new Set<string>(
  INTERNAL_SELECTION_AXIS_VALUES
);

export function isInternalSelectionAxis(axis: string): boolean {
  return INTERNAL_SELECTION_AXES.has(axis);
}

export function stripInternalSelectionAxes(
  attributes: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      ([axis]) => !isInternalSelectionAxis(axis)
    )
  );
}
