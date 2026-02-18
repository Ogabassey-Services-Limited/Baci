// Cache for Intl.NumberFormat instances to prevent expensive re-creation
// This significantly improves performance when rendering lists of prices (e.g. product grids)
const formatterCache = new Map<string, Intl.NumberFormat>();

/**
 * Format amount as currency with caching for performance
 * @param amount - The number to format
 * @param options - Optional Intl.NumberFormatOptions to override defaults
 * @param currency - Currency code (default: 'NGN')
 * @param locale - Locale string (default: 'en-NG')
 */
export const formatCurrency = (
  amount: number,
  options?: Partial<Intl.NumberFormatOptions>,
  currency = 'NGN',
  locale = 'en-NG'
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
  const cacheKey = `${locale}-${JSON.stringify(finalOptions)}`;

  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    if (formatterCache.size > 50) formatterCache.clear();
    formatter = new Intl.NumberFormat(locale, finalOptions);
    formatterCache.set(cacheKey, formatter);
  }

  return formatter.format(amount);
};

/**
 * Format currency without decimal places (compact display)
 */
export const formatCurrencyCompact = (
  amount: number,
  currency = 'NGN',
  locale = 'en-NG'
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

export const formatCompactCurrency = (amount: number) => {
  if (amount >= 1000000000) return `₦${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `₦${amount.toLocaleString()}`;
  return `₦${amount.toFixed(2)}`;
};
