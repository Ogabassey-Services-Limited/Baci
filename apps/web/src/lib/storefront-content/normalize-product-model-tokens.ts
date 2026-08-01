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
const LEADING_CONDITION_TOKENS = new Set([
  'clearance',
  'new',
  'open',
  'premium',
  'refurb',
  'refurbished',
  'sale',
  'sealed',
  'used',
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
const DISPLAY_SUFFIX_MARKER_TOKENS = new Set([
  '4k',
  '8k',
  'display',
  'fhd',
  'inch',
  'ips',
  'oled',
  'retina',
  'screen',
  'touchscreen',
  'uhd',
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

  let markerIndex = suffixIndex - 1;
  while (
    markerIndex >= 0 &&
    CONNECTIVITY_MARKER_TOKENS.has(tokens[markerIndex] ?? '')
  ) {
    markerIndex -= 1;
  }
  return tokens.slice(0, markerIndex + 1);
}

function stripDecimalDisplaySuffix(tokens: string[]) {
  const decimalIndex = tokens.findIndex((token, index) => {
    const nextToken = tokens[index + 1] ?? '';
    if (!/^\d{2}$/u.test(token) || !/^\d$/u.test(nextToken)) {
      return false;
    }

    const displaySize = Number(token);
    return (
      displaySize >= 10 &&
      displaySize <= 20 &&
      tokens
        .slice(index + 2)
        .some((suffixToken) => DISPLAY_SUFFIX_MARKER_TOKENS.has(suffixToken))
    );
  });

  return decimalIndex >= 0 ? tokens.slice(0, decimalIndex) : tokens;
}

function isConvertibleInConnector(tokens: string[], index: number) {
  return (
    tokens[index] === 'in' &&
    /^\d+$/u.test(tokens[index - 1] ?? '') &&
    /^\d+$/u.test(tokens[index + 1] ?? '')
  );
}

/** Removes catalog suffixes that describe merchandising, region, or connectivity. */
export function normalizeProductModelTokens(tokens: string[]) {
  const withoutLeadingCondition = LEADING_CONDITION_TOKENS.has(tokens[0] ?? '')
    ? tokens.slice(1)
    : tokens;
  const withoutMerchandising = stripFirstMatchingSuffix(
    withoutLeadingCondition,
    (token, index) => index > 0 && MERCHANDISING_SUFFIX_TOKENS.has(token)
  );
  const withoutConnectivity =
    stripOptionalConnectivitySuffix(withoutMerchandising);
  const withoutDisplaySuffix = stripDecimalDisplaySuffix(withoutConnectivity);

  return withoutDisplaySuffix.filter(
    (token, index) =>
      !REGION_OR_VARIANT_SUFFIX_TOKENS.has(token) ||
      isConvertibleInConnector(withoutDisplaySuffix, index)
  );
}
