function normalizeLocationPhrase(value: string): string {
  return (
    value
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.join(' ') ?? ''
  );
}

export function filterByLocationPhrase<T>(
  items: T[],
  city: string,
  state: string,
  getLocation: (item: T) => string
): T[] {
  const normalizedCity = normalizeLocationPhrase(city);
  const normalizedState = normalizeLocationPhrase(state);
  if (!normalizedCity || normalizedCity === normalizedState) return items;

  const cityPhrase = ` ${normalizedCity} `;
  const cityMatches = items.filter((item) => {
    const location = normalizeLocationPhrase(getLocation(item));
    return ` ${location} `.includes(cityPhrase);
  });

  return cityMatches.length > 0 ? cityMatches : items;
}
