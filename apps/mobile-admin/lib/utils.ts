export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount);
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
