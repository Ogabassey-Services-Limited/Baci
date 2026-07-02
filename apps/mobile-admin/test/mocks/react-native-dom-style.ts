export function getReactNativeDomStyle(
  style: unknown
): Record<string, string | number> | undefined {
  if (Array.isArray(style)) {
    return Object.assign(
      {},
      ...style.filter(
        (entry): entry is Record<string, string | number> =>
          Boolean(entry) && typeof entry === 'object'
      )
    );
  }

  return style && typeof style === 'object'
    ? (style as Record<string, string | number>)
    : undefined;
}
