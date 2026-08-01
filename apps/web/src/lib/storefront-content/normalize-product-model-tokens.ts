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
  'nfid',
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
const COLOR_SUFFIX_TOKENS = new Set([
  'beige',
  'black',
  'blue',
  'bronze',
  'brown',
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
  'orange',
  'pink',
  'platinum',
  'purple',
  'red',
  'rose',
  'silver',
  'starlight',
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
  'e',
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

function isTerminalColorSuffix(tokens: string[], index: number) {
  return tokens
    .slice(index + 1)
    .every(
      (token) => MERCHANDISING_SUFFIX_TOKENS.has(token) || /^\d/u.test(token)
    );
}

function stripOptionalConnectivitySuffix(tokens: string[]) {
  const suffixIndex = tokens.findIndex(
    (token, index) =>
      token === 'esim' ||
      token === 'lte' ||
      token === 'cellular' ||
      token === 'gps' ||
      token === 'wifi' ||
      (token === 'wi' && tokens[index + 1] === 'fi') ||
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

function stripDecimalDisplaySuffix(
  tokens: string[],
  stripTerminalDisplay = false
) {
  const decimalIndex = tokens.findIndex((token, index) => {
    const nextToken = tokens[index + 1] ?? '';
    if (!/^\d{2}$/u.test(token) || !/^\d$/u.test(nextToken)) {
      return false;
    }

    const displaySize = Number(token);
    const isTerminalDisplay =
      stripTerminalDisplay &&
      index + 2 === tokens.length &&
      displaySize >= 10 &&
      displaySize <= 20;
    return (
      displaySize >= 10 &&
      displaySize <= 20 &&
      (isTerminalDisplay ||
        tokens
          .slice(index + 2)
          .some((suffixToken) => DISPLAY_SUFFIX_MARKER_TOKENS.has(suffixToken)))
    );
  });

  return decimalIndex >= 0 ? tokens.slice(0, decimalIndex) : tokens;
}

function stripOptionalFeatureSuffix(tokens: string[]) {
  const touchBarIndex = tokens.findIndex(
    (token, index) =>
      token === 'touchbar' || (token === 'touch' && tokens[index + 1] === 'bar')
  );

  return touchBarIndex >= 0 ? tokens.slice(0, touchBarIndex) : tokens;
}

function stripOptionalOrdinalGenerationConnectorSuffix(tokens: string[]) {
  const ordinalPattern = /^(\d+)(?:st|nd|rd|th)$/u;
  const generationIndex = tokens.findIndex(
    (token, index) =>
      ordinalPattern.test(token) &&
      ['gen', 'generation'].includes(tokens[index + 1] ?? '') &&
      tokens[index + 2] === 'type' &&
      tokens[index + 3] === 'c' &&
      index + 4 === tokens.length
  );
  if (generationIndex < 0) {
    return tokens;
  }

  const generation = tokens[generationIndex]?.match(ordinalPattern)?.[1];
  return generation
    ? [...tokens.slice(0, generationIndex), generation]
    : tokens;
}

function stripSplitCapacitySuffix(tokens: string[]) {
  const capacityIndex = tokens.findIndex(
    (token, index) =>
      /^\d+$/u.test(token) &&
      ['gb', 'tb', 'mb'].includes(tokens[index + 1] ?? '')
  );
  return capacityIndex >= 0
    ? [...tokens.slice(0, capacityIndex), ...tokens.slice(capacityIndex + 2)]
    : tokens;
}

function isInternalGameTitleToken(
  tokens: string[],
  index: number,
  preserveGameTitleTokens: boolean
) {
  return (
    preserveGameTitleTokens &&
    tokens[index] === 'new' &&
    tokens
      .slice(index + 1)
      .some((token) => !MERCHANDISING_SUFFIX_TOKENS.has(token))
  );
}

function isConvertibleInConnector(tokens: string[], index: number) {
  return (
    tokens[index] === 'in' &&
    /^\d+$/u.test(tokens[index - 1] ?? '') &&
    /^\d+$/u.test(tokens[index + 1] ?? '')
  );
}

/** Removes catalog suffixes that describe merchandising, region, or connectivity. */
export function normalizeProductModelTokens(
  tokens: string[],
  preserveGameTitleTokens = false,
  stripTerminalDisplay = false
) {
  const withoutLeadingCondition = LEADING_CONDITION_TOKENS.has(tokens[0] ?? '')
    ? tokens.slice(1)
    : tokens;
  const withoutMerchandising = stripFirstMatchingSuffix(
    withoutLeadingCondition,
    (token, index) =>
      index > 0 &&
      MERCHANDISING_SUFFIX_TOKENS.has(token) &&
      !isInternalGameTitleToken(
        withoutLeadingCondition,
        index,
        preserveGameTitleTokens
      ) &&
      (!COLOR_SUFFIX_TOKENS.has(token) ||
        (!preserveGameTitleTokens &&
          isTerminalColorSuffix(withoutLeadingCondition, index)))
  );
  const withoutConnectivity =
    stripOptionalConnectivitySuffix(withoutMerchandising);
  const withoutOrdinalGenerationConnector =
    stripOptionalOrdinalGenerationConnectorSuffix(withoutConnectivity);
  const withoutDisplaySuffix = stripDecimalDisplaySuffix(
    withoutOrdinalGenerationConnector,
    stripTerminalDisplay
  );
  const withoutOptionalFeature =
    stripOptionalFeatureSuffix(withoutDisplaySuffix);
  const withoutSplitCapacity = stripSplitCapacitySuffix(withoutOptionalFeature);

  return withoutSplitCapacity.filter(
    (token, index) =>
      preserveGameTitleTokens ||
      !REGION_OR_VARIANT_SUFFIX_TOKENS.has(token) ||
      isConvertibleInConnector(withoutSplitCapacity, index)
  );
}
