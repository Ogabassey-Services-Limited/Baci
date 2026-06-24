export function getFirstImageIndexForColor(args: {
  color: string | null | undefined;
  colorImages?: Record<string, string[]>;
  images: string[];
  variantImage?: string | null;
}) {
  // Prefer the selected variant's own photo so a price-first default that picks
  // a later storage/condition-only SKU opens on that variant's image rather than
  // the first image in its color bucket.
  const variantImage = args.variantImage?.trim();
  if (variantImage) {
    const variantIndex = args.images.indexOf(variantImage);
    if (variantIndex >= 0) {
      return variantIndex;
    }
  }

  const color = args.color?.trim();
  if (!color) {
    return 0;
  }

  const preferredImages = args.colorImages?.[color] ?? [];
  const preferredImage = preferredImages.find(Boolean);
  if (!preferredImage) {
    return 0;
  }

  const index = args.images.indexOf(preferredImage);
  return index >= 0 ? index : 0;
}
