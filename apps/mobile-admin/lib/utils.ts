// Cache for Intl.NumberFormat instances to prevent expensive re-creation
// This significantly improves performance when rendering lists of prices (e.g. product grids)
const formatterCache = new Map<string, Intl.NumberFormat>();

/**
 * Format amount as currency with caching for performance.
 * Locale defaults to the runtime/device locale so the formatter adapts across
 * markets — currency defaults to NGN only because the pilot launches there.
 */
export const formatCurrency = (
  amount: number,
  options?: Partial<Intl.NumberFormatOptions>,
  currency = 'NGN',
  locale?: string
) => {
  const finalOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  };

  // Create a cache key based on locale and finalOptions (not caller options)
  // Using finalOptions ensures identical effective formatters share one cache entry
  const cacheKey = `${locale ?? 'default'}-${JSON.stringify(finalOptions)}`;

  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    if (formatterCache.size > 50) formatterCache.clear();
    formatter = new Intl.NumberFormat(locale, finalOptions);
    formatterCache.set(cacheKey, formatter);
  }

  return formatter.format(amount);
};

/**
 * Format currency without decimal places.
 */
export const formatCurrencyNoDecimals = (
  amount: number,
  currency = 'NGN',
  locale?: string
) => {
  return formatCurrency(
    amount,
    { minimumFractionDigits: 0, maximumFractionDigits: 0 },
    currency,
    locale
  );
};

/**
 * Strips HTML tags from a string by iteratively applying the regex until no more matches.
 * This prevents incomplete sanitization from nested patterns like <scr<script>ipt>.
 *
 * Security: This function does NOT decode HTML entities to prevent double-unescaping
 * attacks where encoded content like &lt;script&gt; could be decoded to <script>.
 * HTML entities are converted to safe readable characters (spaces for nbsp, etc.)
 */
export function stripHtmlTags(text: string | null | undefined): string {
  // Handle null/undefined input
  if (text == null) return '';

  // Limit input length to prevent ReDoS attacks
  const maxLength = 100000;
  const truncated = text.length > maxLength ? text.slice(0, maxLength) : text;

  // Use non-greedy match with length limit per tag to prevent catastrophic backtracking
  const htmlTagRegex = /<[^>]{0,1000}>/g;
  let result = truncated;
  let previous: string;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Iteratively remove HTML tags until no more are found
  // This handles cases like <scr<script>ipt> which become <script> after one pass
  do {
    previous = result;
    result = result.replace(htmlTagRegex, '');
    iterations++;
  } while (result !== previous && iterations < maxIterations);

  // Decode only safe HTML entities (whitespace and typographic)
  // DO NOT decode &lt; &gt; &amp; as these could reintroduce dangerous characters
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™');

  // Remove any remaining encoded entities that look suspicious
  // This catches numeric entities like &#60; (which is <)
  result = result.replace(/&#x?[0-9a-fA-F]+;/g, '');

  // Remove literal &lt; &gt; &amp; - leave them as-is or remove
  // For plain text display, we can safely show these as literal text
  // but for extra safety in case of WebView rendering, we remove angle bracket entities
  result = result.replace(/&lt;/g, '').replace(/&gt;/g, '');

  return result.trim();
}

const currencySymbolCache = new Map<string, string>();
const currencyFallbackCache = new Map<string, string>();

/**
 * Resolve the symbol for a given ISO-4217 currency code using Intl. Falls back
 * to the code itself when the runtime cannot produce a currency part (e.g.
 * unsupported currency). Results are cached per locale+currency because
 * `new Intl.NumberFormat` is relatively expensive in tight render loops.
 */
export const getCurrencySymbol = (
  currency = 'NGN',
  locale?: string
): string => {
  const cacheKey = `${locale ?? 'default'}-${currency}`;
  const cached = currencySymbolCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const cachedFallback = currencyFallbackCache.get(currency);
  if (cachedFallback !== undefined) return cachedFallback;

  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(1);
    const symbol =
      parts.find((part) => part.type === 'currency')?.value ?? currency;
    if (currencySymbolCache.size > 50) currencySymbolCache.clear();
    currencySymbolCache.set(cacheKey, symbol);
    return symbol;
  } catch {
    currencyFallbackCache.set(currency, currency);
    return currency;
  }
};

const compactCurrencyCache = new Map<string, Intl.NumberFormat>();
const fullCurrencyCache = new Map<string, Intl.NumberFormat>();

function getOrCreateFormatter(
  cache: Map<string, Intl.NumberFormat>,
  key: string,
  factory: () => Intl.NumberFormat
): Intl.NumberFormat {
  const cached = cache.get(key);
  if (cached) return cached;
  if (cache.size > 50) cache.clear();
  const formatter = factory();
  cache.set(key, formatter);
  return formatter;
}

/**
 * Compact currency display (e.g. ₦1.2M, $3.4B, -₦1.50M for negatives).
 *
 * Uses Intl.NumberFormat with `notation: 'compact'` so symbol placement,
 * grouping separators, and abbreviation style follow locale conventions
 * (e.g. French "1,2 M€" vs. English "€1.2M"). For values below 1,000 we fall
 * back to standard notation so small amounts display their actual value
 * rather than "₦500" without decimals.
 */
export const formatCurrencyCompactNotation = (
  amount: number,
  currency = 'NGN',
  locale?: string
) => {
  const abs = Math.abs(amount);
  const useCompact = abs >= 1_000;
  const cache = useCompact ? compactCurrencyCache : fullCurrencyCache;
  const cacheKey = `${locale ?? 'default'}-${currency}`;

  try {
    const formatter = getOrCreateFormatter(
      cache,
      cacheKey,
      () =>
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          notation: useCompact ? 'compact' : 'standard',
          compactDisplay: 'short',
          minimumFractionDigits: useCompact ? 1 : 2,
          maximumFractionDigits: 2,
        })
    );
    return formatter.format(amount);
  } catch {
    // Runtime without full Intl data — fall back to a manual format that
    // still handles the sign correctly.
    // This uses `amount`, `currency`, `locale`, `abs`, and
    // `getCurrencySymbol(currency, locale)` to build `${sign}${symbol}${...}`.
    // It assumes prefix currency placement, so suffix locales (for example
    // `1,2 M€`) are not preserved. That's acceptable because this only runs
    // when Intl formatting is unavailable.
    const symbol = getCurrencySymbol(currency, locale);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1_000_000_000) {
      return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(2)}B`;
    }
    if (abs >= 1_000_000) {
      return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}${symbol}${(abs / 1_000).toFixed(2)}K`;
    }
    return `${sign}${symbol}${abs.toFixed(2)}`;
  }
};
