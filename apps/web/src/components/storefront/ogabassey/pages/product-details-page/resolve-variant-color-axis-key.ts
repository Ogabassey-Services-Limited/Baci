type ColorAxisKey = 'color' | 'Colour' | 'colour';

// Some legacy OgaBassey catalogs store the color axis under the British
// spelling (`Colour`/`colour`) instead of the canonical `color`. The shared
// variant resolver matches attribute keys exactly, so the selected color must
// be emitted under whichever key the variants actually carry — otherwise a
// legacy `Colour`-only variant never matches a canonical `color` selection.
const COLOR_AXIS_KEYS: readonly ColorAxisKey[] = ['color', 'Colour', 'colour'];

export function isColorAxisKey(key: string): key is ColorAxisKey {
  return (COLOR_AXIS_KEYS as readonly string[]).includes(key);
}

/**
 * Pick the color-axis key the product's variants use for `colorValue`. Prefers
 * the canonical `color` (including mixed catalogs), then the legacy `Colour`/
 * `colour` aliases, and defaults to `color` when nothing matches.
 */
export function resolveVariantColorAxisKey(
  variants:
    | ReadonlyArray<{ attributes?: Record<string, string> | null }>
    | null
    | undefined,
  colorValue: string
): ColorAxisKey {
  const target = colorValue.trim();

  if (target && variants) {
    for (const key of COLOR_AXIS_KEYS) {
      if (
        variants.some((variant) => variant.attributes?.[key]?.trim() === target)
      ) {
        return key;
      }
    }
  }

  return 'color';
}
