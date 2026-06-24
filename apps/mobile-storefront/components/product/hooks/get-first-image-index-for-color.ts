export function getFirstImageIndexForColor(args: {
  color: string | null | undefined;
  colorImages?: Record<string, string[]>;
  images: string[];
}) {
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
