const RGB_CHANNEL_PATTERN = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const RGB_COLOR_PATTERN = new RegExp(
  `^rgba?\\(\\s*(${RGB_CHANNEL_PATTERN})\\s*,\\s*(${RGB_CHANNEL_PATTERN})\\s*,\\s*(${RGB_CHANNEL_PATTERN})(?:\\s*,\\s*[\\d.]+\\s*)?\\)$`,
  'i'
);

export function withTwentyPercentAlpha(color: string): string {
  const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(color);
  if (shortHexMatch) {
    const [red, green, blue] = shortHexMatch[1].split('');
    return `#${red}${red}${green}${green}${blue}${blue}33`;
  }

  const longHexMatch = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
  if (longHexMatch) {
    return `#${longHexMatch[1]}33`;
  }

  const rgbMatch = RGB_COLOR_PATTERN.exec(color);
  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;
    return `rgba(${red}, ${green}, ${blue}, 0.2)`;
  }

  return color;
}
