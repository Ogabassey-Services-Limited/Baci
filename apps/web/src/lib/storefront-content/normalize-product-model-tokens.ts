import { PRODUCT_VARIANT_COLOR_TOKENS } from '@/config/product-variant-color-tokens';
import { isProductVariantRegionToken } from './is-product-variant-region-token';
import { modelTokenMatchers } from './model-token-matchers';

const MERCHANDISING_ONLY_TOKENS = new Set([
  'clearance',
  'new',
  'nfid',
  'open',
  'premium',
  'refurb',
  'refurbished',
  'sale',
  'sealed',
  'used',
]);
const MERCHANDISING_SUFFIX_TOKENS = new Set([
  ...PRODUCT_VARIANT_COLOR_TOKENS,
  ...MERCHANDISING_ONLY_TOKENS,
]);
const LEADING_CONDITION_TOKENS = new Set(
  [...MERCHANDISING_ONLY_TOKENS].filter((token) => token !== 'nfid')
);
const CONNECTIVITY_MARKER_TOKENS = new Set([
  'dual',
  'e',
  'nano',
  'physical',
  'single',
]);
const LEADING_CONNECTIVITY_DESCRIPTOR_TOKENS = new Set([
  'speaker',
  'headphones',
  'earbuds',
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
const COLOR_MODIFIER_TOKENS = new Set(['sierra', 'space']);

const { isConvertibleInConnector } = modelTokenMatchers;

function stripFirstMatchingSuffix(
  tokens: string[],
  predicate: (token: string, index: number) => boolean
) {
  const suffixIndex = tokens.findIndex(predicate);
  return suffixIndex >= 0 ? tokens.slice(0, suffixIndex) : tokens;
}
function stripColorSuffix(tokens: string[]) {
  const colorIndex = tokens.findIndex(
    (token, index) =>
      PRODUCT_VARIANT_COLOR_TOKENS.has(token) &&
      isTerminalColorSuffix(tokens, index)
  );
  if (colorIndex < 0) {
    return tokens;
  }
  let suffixStart = colorIndex;
  while (
    suffixStart > 0 &&
    COLOR_MODIFIER_TOKENS.has(tokens[suffixStart - 1] ?? '')
  ) {
    suffixStart -= 1;
  }
  return tokens.slice(0, suffixStart);
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
      token === 'bluetooth' ||
      token === 'bt' ||
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
  if (markerIndex < 0) {
    const leadingTokens = tokens.slice(suffixIndex + 1);
    let firstModelIndex = 0;
    while (
      firstModelIndex < leadingTokens.length &&
      LEADING_CONNECTIVITY_DESCRIPTOR_TOKENS.has(
        leadingTokens[firstModelIndex] ?? ''
      )
    ) {
      firstModelIndex += 1;
    }
    return leadingTokens.slice(firstModelIndex);
  }
  return tokens.slice(0, markerIndex + 1);
}
function stripDecimalDisplaySuffix(
  tokens: string[],
  stripTerminalDisplay = false
) {
  const decimalIndex = tokens.findLastIndex((token, index) => {
    const nextToken = tokens[index + 1] ?? '';
    if (!/^\d{1,2}$/u.test(token) || !/^\d$/u.test(nextToken)) {
      return false;
    }

    const displaySize = Number(`${token}.${nextToken}`);
    const isTerminalDisplay =
      stripTerminalDisplay &&
      index + 2 === tokens.length &&
      displaySize >= 10 &&
      displaySize <= 20;
    return (
      displaySize >= 5 &&
      displaySize <= 20 &&
      (isTerminalDisplay ||
        tokens
          .slice(index + 2)
          .some((suffixToken) =>
            DISPLAY_SUFFIX_MARKER_TOKENS.has(suffixToken)
          ) ||
        (tokens.length > index + 2 &&
          tokens
            .slice(index + 2)
            .every((suffixToken) => /^\d+(?:gb|tb|mb)$/u.test(suffixToken))))
    );
  });

  return decimalIndex > 0 ? tokens.slice(0, decimalIndex) : tokens;
}
function stripOptionalFeatureSuffix(tokens: string[]) {
  const touchBarIndex = tokens.findIndex(
    (token, index) =>
      token === 'touchbar' || (token === 'touch' && tokens[index + 1] === 'bar')
  );
  const allInOneIndex = tokens.findIndex(
    (token, index) =>
      token === 'all' &&
      tokens[index + 1] === 'in' &&
      tokens[index + 2] === 'one'
  );
  const suffixIndex = [
    touchBarIndex,
    allInOneIndex >= 0 && tokens.slice(allInOneIndex + 3).includes('printer')
      ? allInOneIndex
      : -1,
  ].find((index) => index >= 0);
  return suffixIndex !== undefined ? tokens.slice(0, suffixIndex) : tokens;
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
  const normalizedTokens: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    if (
      /^\d+$/u.test(token) &&
      ['gb', 'tb', 'mb'].includes(tokens[index + 1] ?? '')
    ) {
      index += 1;
      continue;
    }
    normalizedTokens.push(token);
  }
  return normalizedTokens;
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

/** Removes catalog suffixes that describe merchandising, region, or connectivity. */
export function normalizeProductModelTokens(
  tokens: string[],
  preserveGameTitleTokens = false,
  stripTerminalDisplay = false
) {
  const preservesLeadingGameTitle =
    preserveGameTitleTokens && isInternalGameTitleToken(tokens, 0, true);
  const withoutLeadingCondition =
    LEADING_CONDITION_TOKENS.has(tokens[0] ?? '') && !preservesLeadingGameTitle
      ? tokens.slice(1)
      : tokens;
  const withoutMerchandising = preserveGameTitleTokens
    ? stripFirstMatchingSuffix(
        withoutLeadingCondition,
        (token, index) =>
          index > 0 &&
          MERCHANDISING_SUFFIX_TOKENS.has(token) &&
          !isInternalGameTitleToken(
            withoutLeadingCondition,
            index,
            preserveGameTitleTokens
          ) &&
          (!PRODUCT_VARIANT_COLOR_TOKENS.has(token) ||
            (!preserveGameTitleTokens &&
              isTerminalColorSuffix(withoutLeadingCondition, index)))
      )
    : stripColorSuffix(
        stripFirstMatchingSuffix(
          withoutLeadingCondition,
          (token, index) =>
            index > 0 &&
            MERCHANDISING_ONLY_TOKENS.has(token) &&
            !isInternalGameTitleToken(
              withoutLeadingCondition,
              index,
              preserveGameTitleTokens
            )
        )
      );
  const withoutConnectivity =
    stripOptionalConnectivitySuffix(withoutMerchandising);
  const withoutOrdinalGenerationConnector =
    stripOptionalOrdinalGenerationConnectorSuffix(withoutConnectivity);
  const withoutDisplaySuffix = stripDecimalDisplaySuffix(
    withoutOrdinalGenerationConnector,
    stripTerminalDisplay
  );
  const withoutFeature = stripOptionalFeatureSuffix(withoutDisplaySuffix);
  const withoutSplitCapacity = stripSplitCapacitySuffix(withoutFeature);

  return withoutSplitCapacity.filter(
    (token, index) =>
      preserveGameTitleTokens ||
      !isProductVariantRegionToken(token) ||
      isConvertibleInConnector(withoutSplitCapacity, index) ||
      (token === 'in' &&
        withoutSplitCapacity[index - 1] === 'all' &&
        withoutSplitCapacity[index + 1] === 'one')
  );
}
