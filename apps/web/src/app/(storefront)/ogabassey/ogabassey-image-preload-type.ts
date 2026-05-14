const IMAGE_PRELOAD_TYPES = {
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

export function getOgabasseyImagePreloadType(src: string) {
  const transformedFormat = src.match(
    /(?:^|[?&/,])format=(avif|jpe?g|png|webp)(?:[&/,]|$)/i
  )?.[1];
  const extension =
    transformedFormat ?? src.match(/\.(avif|jpe?g|png|webp)(?:[?#].*)?$/i)?.[1];

  return extension
    ? IMAGE_PRELOAD_TYPES[
        extension.toLowerCase() as keyof typeof IMAGE_PRELOAD_TYPES
      ]
    : undefined;
}
