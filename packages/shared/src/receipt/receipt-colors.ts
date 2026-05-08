export const DEFAULT_RECEIPT_COLOR = '#1a1a2e';
const SAFE_HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandShortHex(color: string): string {
  if (color.length !== 4) {
    return color;
  }

  const [, red, green, blue] = color;
  return `#${red}${red}${green}${green}${blue}${blue}`;
}

export function normalizeReceiptColor(
  value: string | null | undefined,
  fallback = DEFAULT_RECEIPT_COLOR
): string {
  const trimmed = value?.trim();
  if (trimmed && SAFE_HEX_COLOR.test(trimmed)) {
    return expandShortHex(trimmed);
  }

  const fallbackTrimmed = fallback.trim();
  if (SAFE_HEX_COLOR.test(fallbackTrimmed)) {
    return expandShortHex(fallbackTrimmed);
  }

  return DEFAULT_RECEIPT_COLOR;
}
