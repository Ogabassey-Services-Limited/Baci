const MERCHANDISING_SUFFIX_TOKENS = new Set([
  'beige',
  'black',
  'blue',
  'bronze',
  'brown',
  'clearance',
  'coral',
  'cream',
  'gold',
  'graphite',
  'gray',
  'green',
  'grey',
  'jet',
  'lavender',
  'midnight',
  'mint',
  'new',
  'open',
  'orange',
  'pink',
  'platinum',
  'premium',
  'purple',
  'red',
  'refurb',
  'refurbished',
  'rose',
  'sale',
  'sealed',
  'silver',
  'starlight',
  'used',
  'violet',
  'white',
  'yellow',
]);
const REGION_OR_VARIANT_SUFFIX_TOKENS = new Set([
  'ca',
  'cn',
  'eu',
  'gb',
  'global',
  'in',
  'international',
  'jp',
  'ng',
  'nigeria',
  'uae',
  'uk',
  'us',
]);
const CONNECTIVITY_MARKER_TOKENS = new Set([
  'dual',
  'nano',
  'physical',
  'single',
]);

function stripFirstMatchingSuffix(
  tokens: string[],
  predicate: (token: string, index: number) => boolean
) {
  const suffixIndex = tokens.findIndex(predicate);
  return suffixIndex >= 0 ? tokens.slice(0, suffixIndex) : tokens;
}

function stripOptionalConnectivitySuffix(tokens: string[]) {
  const suffixIndex = tokens.findIndex(
    (token, index) =>
      token === 'esim' ||
      (token === 'sim' &&
        CONNECTIVITY_MARKER_TOKENS.has(tokens[index - 1] ?? ''))
  );
  if (suffixIndex < 0) {
    return tokens;
  }

  const markerIndex = suffixIndex - 1;
  const startsWithMarker = CONNECTIVITY_MARKER_TOKENS.has(
    tokens[markerIndex] ?? ''
  );
  return tokens.slice(0, startsWithMarker ? markerIndex : suffixIndex);
}

/** Removes catalog suffixes that describe merchandising, region, or connectivity. */
export function normalizeProductModelTokens(tokens: string[]) {
  const withoutMerchandising = stripFirstMatchingSuffix(tokens, (token) =>
    MERCHANDISING_SUFFIX_TOKENS.has(token)
  );
  const withoutConnectivity =
    stripOptionalConnectivitySuffix(withoutMerchandising);

  return withoutConnectivity.filter(
    (token) => !REGION_OR_VARIANT_SUFFIX_TOKENS.has(token)
  );
}
