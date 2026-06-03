interface ProductImageSourceResult {
  isPlaceholder: boolean;
  src: string;
}

export function resolveProductImageSource(
  candidates: readonly (null | string | undefined)[],
  placeholder: string
): ProductImageSourceResult {
  const source = candidates
    .map((candidate) => candidate?.trim() ?? '')
    .find((candidate) => candidate.length > 0);

  if (!source) {
    return { isPlaceholder: true, src: placeholder };
  }

  return { isPlaceholder: false, src: source };
}
