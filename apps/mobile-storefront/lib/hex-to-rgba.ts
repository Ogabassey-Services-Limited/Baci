/**
 * Convert a hex color string and an alpha value into an `rgba(...)` string.
 *
 * - Accepts 3-digit (#abc) or 6-digit (#aabbcc) hex; with or without the leading `#`.
 * - Invalid hex inputs return a fully transparent fallback (`rgba(0,0,0,0)`); a
 *   `console.warn` is emitted in `__DEV__` so misuse is visible during development.
 * - The `alpha` value is coerced to a number and clamped to `[0, 1]`. Non-finite
 *   alpha values default to 1 (fully opaque) and emit a dev-only warning.
 */
export function hexToRgba(hexColor: string, alpha: number): string {
  let normalizedAlpha = Number(alpha);
  if (!Number.isFinite(normalizedAlpha)) {
    if (__DEV__) {
      console.warn(
        `hexToRgba: non-finite alpha received (${String(alpha)}); defaulting to 1`
      );
    }
    normalizedAlpha = 1;
  } else if (normalizedAlpha < 0 || normalizedAlpha > 1) {
    if (__DEV__) {
      console.warn(
        `hexToRgba: alpha out of range (${normalizedAlpha}); clamping to [0,1]`
      );
    }
    normalizedAlpha = Math.min(1, Math.max(0, normalizedAlpha));
  }

  const normalizedHex = hexColor.replace('#', '');
  const expandedHex =
    normalizedHex.length === 3 && /^[\da-f]{3}$/i.test(normalizedHex)
      ? normalizedHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalizedHex;

  if (!/^[\da-f]{6}$/i.test(expandedHex)) {
    if (__DEV__) {
      console.warn(`hexToRgba: invalid hex color received: ${hexColor}`);
    }
    return 'rgba(0,0,0,0)';
  }

  const colorValue = Number.parseInt(expandedHex, 16);
  const red = (colorValue >> 16) & 255;
  const green = (colorValue >> 8) & 255;
  const blue = colorValue & 255;

  return `rgba(${red},${green},${blue},${normalizedAlpha})`;
}
