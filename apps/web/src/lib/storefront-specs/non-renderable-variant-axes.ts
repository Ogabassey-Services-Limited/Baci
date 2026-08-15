/**
 * Canonical variant axes that are display-only metadata, swatches, or informational notes,
 * and should not be rendered as selectable attribute buttons in variant pickers.
 */
const ALWAYS_NON_RENDERABLE_VARIANT_AXES = new Set([
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
  'warranty_note',
  'delivery_notice',
  'notice',
]);

/**
 * Determines whether a variant axis should be rendered as an interactive picker.
 * Excludes non-renderable metadata axes and single-option condition/warranty axes.
 */
export function isRenderableVariantAxis(
  axis: string,
  optionCount: number
): boolean {
  if (!axis || ALWAYS_NON_RENDERABLE_VARIANT_AXES.has(axis)) {
    return false;
  }

  // Condition and warranty are informational metadata when single-option,
  // but become selectable SKU dimensions when multiple options exist.
  if (axis === 'condition' || axis === 'warranty') {
    return optionCount > 1;
  }

  return optionCount > 0;
}
