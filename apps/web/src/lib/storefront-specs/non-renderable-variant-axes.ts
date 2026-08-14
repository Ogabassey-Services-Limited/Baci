/**
 * Canonical variant axes that are display-only metadata, swatches, or informational notes,
 * and should not be rendered as selectable attribute buttons in variant pickers.
 */
export const NON_RENDERABLE_VARIANT_AXES = new Set([
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
  'delivery_notice',
  'notice',
]);

/**
 * Determines whether a variant axis should be rendered as an interactive picker.
 * Excludes non-renderable metadata axes and single-option condition axes.
 */
export function isRenderableVariantAxis(
  axis: string,
  optionCount: number
): boolean {
  if (!axis || NON_RENDERABLE_VARIANT_AXES.has(axis)) {
    return false;
  }

  if (axis === 'condition') {
    return optionCount > 1;
  }

  return optionCount > 0;
}
