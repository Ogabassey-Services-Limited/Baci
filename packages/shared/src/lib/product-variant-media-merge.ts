/**
 * Collapses a color-image record so keys that only differ by case share a
 * single bucket. The first-seen casing wins — this matches
 * `buildOrderedColors`, which deduplicates labels case-insensitively and
 * also preserves the first casing it encounters. Without this, a legacy
 * `Black` + `black` pair would remain as two buckets in `colorImages` while
 * the color label list collapses to one entry, leaving half the images
 * unreachable on the PDP.
 */
export function collapseColorImagesCaseInsensitive(
  colorImages: Record<string, string[]>
): Record<string, string[]> {
  const canonicalKeyByLookup = new Map<string, string>();
  const merged: Record<string, string[]> = {};

  for (const [key, images] of Object.entries(colorImages)) {
    const lookup = key.toLowerCase();
    const canonicalKey = canonicalKeyByLookup.get(lookup);

    if (canonicalKey) {
      merged[canonicalKey] = Array.from(
        new Set([...(merged[canonicalKey] ?? []), ...images])
      );
      continue;
    }

    canonicalKeyByLookup.set(lookup, key);
    merged[key] = Array.from(new Set(images));
  }

  return merged;
}

/**
 * Merges legacy and variant color-image records case-insensitively on the
 * color-name key. Rules:
 *
 * - Variants define the canonical casing for the output key.
 * - When a legacy key and a variant key refer to the same color ignoring
 *   case (e.g. `Black` vs `black`), the variant images REPLACE the legacy
 *   images under the variant casing. This preserves the pre-existing
 *   "variant overrides legacy per-key" contract while also eliminating the
 *   split-bucket bug where `buildOrderedColors` collapses the label but
 *   `colorImages` keeps both keys.
 * - Legacy entries whose color does not appear in variants (case-insensitive)
 *   are carried through unchanged.
 *
 * Defensive: callers already pass legacy input through
 * `collapseColorImagesCaseInsensitive`, but this function also collapses
 * case-variant legacy keys internally so a caller that forgets the
 * pre-collapse still gets correct output. Variant inputs are likewise
 * collapsed.
 */
export function mergeColorImagesCaseInsensitive(
  legacy: Record<string, string[]>,
  variants: Record<string, string[]>
): Record<string, string[]> {
  const collapsedLegacy = collapseColorImagesCaseInsensitive(legacy);
  const collapsedVariants = collapseColorImagesCaseInsensitive(variants);

  const variantKeyByLookup = new Map<string, string>();
  for (const variantKey of Object.keys(collapsedVariants)) {
    variantKeyByLookup.set(variantKey.toLowerCase(), variantKey);
  }

  // Preserve the existing property order: legacy insertion order first (so
  // a legacy `Gold` that is overridden by a variant still appears in the
  // original slot), then any variant-only colors. For colors covered by a
  // variant we emit the variant images under the variant's canonical
  // casing; otherwise the legacy entry is carried through unchanged.
  const merged: Record<string, string[]> = {};
  const emittedVariantKeys = new Set<string>();

  for (const [legacyKey, legacyImages] of Object.entries(collapsedLegacy)) {
    const lookup = legacyKey.toLowerCase();
    const variantKey = variantKeyByLookup.get(lookup);
    if (variantKey) {
      merged[variantKey] = Array.from(
        new Set(collapsedVariants[variantKey] ?? [])
      );
      emittedVariantKeys.add(variantKey);
      continue;
    }
    merged[legacyKey] = Array.from(new Set(legacyImages));
  }
  for (const [variantKey, variantImages] of Object.entries(collapsedVariants)) {
    if (emittedVariantKeys.has(variantKey)) {
      continue;
    }
    merged[variantKey] = Array.from(new Set(variantImages));
  }
  return merged;
}
