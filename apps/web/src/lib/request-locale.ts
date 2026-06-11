export function getRequestLocale(headersList: Headers): string | undefined {
  const rawLocale = headersList.get('accept-language')?.split(',')[0];

  if (!rawLocale) {
    return undefined;
  }

  try {
    const [tag] = rawLocale.split(';');
    const trimmed = tag.trim();

    if (!trimmed) {
      return undefined;
    }

    const [canonical] = Intl.getCanonicalLocales(trimmed);

    return canonical;
  } catch {
    return undefined;
  }
}
