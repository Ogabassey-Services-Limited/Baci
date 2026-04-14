const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_PATTERN =
  /^rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const HSL_COLOR_PATTERN =
  /^hsla?\(\s*-?\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const NAMED_COLOR_PATTERN = /^[a-z]+$/i;
const HEX_WITH_ALPHA_PATTERN = /^#([0-9a-f]{6})$/i;

export function isValidCssColor(value: string): boolean {
  return (
    HEX_COLOR_PATTERN.test(value) ||
    RGB_COLOR_PATTERN.test(value) ||
    HSL_COLOR_PATTERN.test(value) ||
    NAMED_COLOR_PATTERN.test(value)
  );
}

export function sanitizeCssColor(
  value: string | null | undefined,
  fallback: string
): string {
  const trimmedValue = value?.trim() ?? '';
  return isValidCssColor(trimmedValue) ? trimmedValue : fallback;
}

export function getTranslucentColor(
  value: string,
  fallback: string,
  alpha = 0.16
): string {
  const sanitizedColor = sanitizeCssColor(value, fallback);
  const hexMatch = sanitizedColor.match(HEX_WITH_ALPHA_PATTERN);

  if (hexMatch) {
    const hexValue = hexMatch[1];
    const red = Number.parseInt(hexValue.slice(0, 2), 16);
    const green = Number.parseInt(hexValue.slice(2, 4), 16);
    const blue = Number.parseInt(hexValue.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return fallback;
}
