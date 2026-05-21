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

  const rgbMatch =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i.exec(
      color
    );
  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;
    return `rgba(${red}, ${green}, ${blue}, 0.2)`;
  }

  return color;
}
