/**
 * Applies alpha to supported color literals and returns `rgba(...)`.
 *
 * Supported inputs:
 * - 3-, 6-, or 8-digit hex strings, with or without a leading `#`
 * - comma-separated `rgb(r, g, b)` and `rgba(r, g, b, a)` values with integer
 *   RGB components from 0 to 255
 *
 * Limitations:
 * - Source alpha in 8-digit hex or `rgba()` is replaced by the provided alpha
 * - CSS named colors, HSL, percent RGB, and CSS Color 4 space/slash syntax are
 *   returned unchanged
 * - Alpha is clamped to the 0..1 range
 */
export function withAlpha(color: string, alpha: number): string {
  const normalizedAlpha = Math.min(Math.max(alpha, 0), 1);
  const input = color.trim();
  const hex = input.replace(/^#/, '');

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex
      .split('')
      .map((value) => Number.parseInt(value + value, 16));
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  if (/^[0-9a-f]{6}$/i.test(hex) || /^[0-9a-f]{8}$/i.test(hex)) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  const rgbMatch = input.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i
  );
  if (rgbMatch) {
    const [r, g, b] = rgbMatch
      .slice(1, 4)
      .map((component) => Number.parseInt(component, 10));
    if ([r, g, b].every((component) => component >= 0 && component <= 255)) {
      return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
    }
  }

  return color;
}
