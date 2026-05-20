// WCAG 2.x relative luminance constants for sRGB colors.
const WCAG_LINEAR_THRESHOLD = 0.03928;
const WCAG_LINEAR_DIVISOR = 12.92;
const WCAG_GAMMA_OFFSET = 0.055;
const WCAG_GAMMA_DIVISOR = 1.055;
const WCAG_GAMMA_EXPONENT = 2.4;
const WCAG_RED_COEFFICIENT = 0.2126;
const WCAG_GREEN_COEFFICIENT = 0.7152;
const WCAG_BLUE_COEFFICIENT = 0.0722;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export function parseHexColor(hexColor: string): RgbColor {
  const normalized = hexColor.replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Unsupported contrast test color: ${hexColor}`);
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

export function linearize(channel: number): number {
  return channel <= WCAG_LINEAR_THRESHOLD
    ? channel / WCAG_LINEAR_DIVISOR
    : ((channel + WCAG_GAMMA_OFFSET) / WCAG_GAMMA_DIVISOR) **
        WCAG_GAMMA_EXPONENT;
}

export function relativeLuminance(hexColor: string): number {
  const { r, g, b } = parseHexColor(hexColor);
  return (
    WCAG_RED_COEFFICIENT * linearize(r) +
    WCAG_GREEN_COEFFICIENT * linearize(g) +
    WCAG_BLUE_COEFFICIENT * linearize(b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}
