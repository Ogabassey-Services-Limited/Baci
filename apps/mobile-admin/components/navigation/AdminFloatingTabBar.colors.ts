export function withHexAlpha(hexColor: string, alpha: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) {
    return hexColor;
  }

  const normalizedAlpha = Math.max(0, Math.min(1, alpha));
  const alphaHex = Math.round(normalizedAlpha * 255)
    .toString(16)
    .padStart(2, '0');

  return `${hexColor}${alphaHex}`;
}
