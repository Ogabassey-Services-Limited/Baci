/**
 * Order Number Utilities
 *
 * Implements validation and parsing for the improved order number format:
 * PREFIX-YYMMDD-XXXX-C
 *
 * Where:
 * - PREFIX: Merchant customizable (1-4 alphanumeric chars)
 * - YYMMDD: Date component
 * - XXXX: Base32 encoded sequence (Crockford's Base32)
 * - C: Check digit for validation
 *
 * Example: ORD-241204-A7K3-2
 */

// Crockford's Base32 alphabet (excludes I, L, O, U to avoid confusion)
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Order number format regex patterns
 */
export const ORDER_NUMBER_PATTERNS = {
  /** New format: PREFIX-YYMMDD-XXXX-C */
  NEW_FORMAT: /^[A-Z0-9]{1,4}-\d{6}-[0-9A-Z]{4}-[0-9A-Z]$/,
  /** Legacy format: #00000001 */
  LEGACY_FORMAT: /^#[0-9]{8}$/,
  /** Either format */
  ANY_FORMAT: /^(#[0-9]{8}|[A-Z0-9]{1,4}-\d{6}-[0-9A-Z]{4}-[0-9A-Z])$/,
};

/**
 * Parsed order number information
 */
export interface ParsedOrderNumber {
  /** Whether the order number is valid */
  isValid: boolean;
  /** The format type (new or legacy) */
  format: 'new' | 'legacy' | 'invalid';
  /** The original order number */
  original: string;
  /** Parsed components (only for new format) */
  components?: {
    prefix: string;
    date: Date;
    dateString: string;
    sequence: string;
    checkDigit: string;
  };
  /** Sequence number (for legacy format) */
  sequenceNumber?: number;
}

/**
 * Calculate check digit using Luhn mod 32 algorithm
 */
function calculateCheckDigit(orderStr: string): string {
  // Remove hyphens and convert to uppercase
  const cleanStr = orderStr.replace(/-/g, '').toUpperCase();

  let sum = 0;
  let factor = 2;

  // Process from right to left
  for (let i = cleanStr.length - 1; i >= 0; i--) {
    let charVal = BASE32_ALPHABET.indexOf(cleanStr[i]);
    if (charVal < 0) charVal = 0;

    if (factor === 2) {
      charVal *= 2;
      if (charVal >= 32) {
        charVal = Math.floor(charVal / 32) + (charVal % 32);
      }
      factor = 1;
    } else {
      factor = 2;
    }

    sum += charVal;
  }

  // Calculate check digit
  const checkVal = (32 - (sum % 32)) % 32;
  return BASE32_ALPHABET[checkVal];
}

/**
 * Validate an order number's check digit
 */
export function validateOrderNumber(orderNumber: string): boolean {
  if (!orderNumber) return false;

  // Handle legacy format
  if (ORDER_NUMBER_PATTERNS.LEGACY_FORMAT.test(orderNumber)) {
    return true;
  }

  // Validate new format
  if (!ORDER_NUMBER_PATTERNS.NEW_FORMAT.test(orderNumber)) {
    return false;
  }

  const parts = orderNumber.split('-');
  if (parts.length !== 4) return false;

  // Extract check digit
  const checkDigit = parts[3];

  // Reconstruct base string without check digit
  const baseStr = `${parts[0]}-${parts[1]}-${parts[2]}`;

  // Calculate expected check digit
  const expectedCheck = calculateCheckDigit(baseStr);

  return checkDigit === expectedCheck;
}

/**
 * Parse an order number into its components
 */
export function parseOrderNumber(orderNumber: string): ParsedOrderNumber {
  if (!orderNumber) {
    return {
      isValid: false,
      format: 'invalid',
      original: orderNumber,
    };
  }

  // Handle legacy format
  if (ORDER_NUMBER_PATTERNS.LEGACY_FORMAT.test(orderNumber)) {
    const sequenceNumber = Number.parseInt(orderNumber.replace('#', ''), 10);
    return {
      isValid: true,
      format: 'legacy',
      original: orderNumber,
      sequenceNumber,
    };
  }

  // Handle new format
  if (ORDER_NUMBER_PATTERNS.NEW_FORMAT.test(orderNumber)) {
    const isValid = validateOrderNumber(orderNumber);
    const parts = orderNumber.split('-');

    // Parse date from YYMMDD
    const dateStr = parts[1];
    const year = 2000 + Number.parseInt(dateStr.substring(0, 2), 10);
    const month = Number.parseInt(dateStr.substring(2, 4), 10) - 1;
    const day = Number.parseInt(dateStr.substring(4, 6), 10);
    const date = new Date(year, month, day);

    return {
      isValid,
      format: 'new',
      original: orderNumber,
      components: {
        prefix: parts[0],
        date,
        dateString: dateStr,
        sequence: parts[2],
        checkDigit: parts[3],
      },
    };
  }

  return {
    isValid: false,
    format: 'invalid',
    original: orderNumber,
  };
}

/**
 * Format an order number for display (adds visual spacing)
 */
export function formatOrderNumberForDisplay(orderNumber: string): string {
  const parsed = parseOrderNumber(orderNumber);

  if (parsed.format === 'legacy') {
    // Format legacy as #0000-0001 for readability
    const num = orderNumber.replace('#', '');
    return `#${num.substring(0, 4)}-${num.substring(4)}`;
  }

  // New format is already readable
  return orderNumber;
}

/**
 * Extract searchable parts from an order number
 * Useful for fuzzy matching in customer support
 */
export function getSearchableTerms(orderNumber: string): string[] {
  const parsed = parseOrderNumber(orderNumber);
  const terms: string[] = [orderNumber];

  if (parsed.format === 'legacy') {
    // Add variations without hash, with different groupings
    const num = orderNumber.replace('#', '');
    terms.push(num);
    terms.push(`${num.substring(0, 4)}-${num.substring(4)}`);
  } else if (parsed.format === 'new' && parsed.components) {
    // Add individual components
    terms.push(parsed.components.prefix);
    terms.push(parsed.components.sequence);
    terms.push(orderNumber.replace(/-/g, '')); // No hyphens
    // Last 4 chars (sequence + check)
    terms.push(`${parsed.components.sequence}${parsed.components.checkDigit}`);
  }

  return terms;
}

/**
 * Check if a string looks like an order number (partial match)
 */
export function looksLikeOrderNumber(input: string): boolean {
  const normalized = input.toUpperCase().trim();

  // Check for legacy format or partial
  if (/^#?[0-9]{1,8}$/.test(normalized)) {
    return true;
  }

  // Check for new format or partial
  if (
    /^[A-Z0-9]{1,4}(-[A-Z0-9]{0,6})?(-[A-Z0-9]{0,4})?(-[A-Z0-9])?$/.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Normalize user input that might be an order number
 * Handles common input variations
 */
export function normalizeOrderNumberInput(input: string): string {
  let normalized = input.toUpperCase().trim();

  // Remove common prefixes users might add
  normalized = normalized.replace(/^(ORDER|ORD|NO|#)\s*/i, '');

  // Add # prefix for pure numeric inputs (legacy format)
  if (/^[0-9]{8}$/.test(normalized)) {
    normalized = `#${normalized}`;
  }

  // Add # prefix for zero-padded numeric inputs
  if (/^[0-9]{1,7}$/.test(normalized)) {
    normalized = `#${normalized.padStart(8, '0')}`;
  }

  return normalized;
}

/**
 * Validate order prefix format
 */
export function isValidOrderPrefix(prefix: string): boolean {
  return /^[A-Z0-9]{1,4}$/.test(prefix.toUpperCase());
}

/**
 * Suggested prefixes based on merchant business name
 */
export function suggestOrderPrefix(businessName: string): string[] {
  const suggestions: string[] = [];
  const words = businessName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return ['ORD', 'BCI'];
  }

  // First word, up to 4 chars
  if (words[0]) {
    suggestions.push(words[0].substring(0, 4));
  }

  // Initials of first words
  if (words.length >= 2) {
    const initials = words
      .slice(0, 4)
      .map((w) => w[0])
      .join('');
    suggestions.push(initials);
  }

  // First 2 chars of first 2 words
  if (words.length >= 2) {
    const combo = words[0].substring(0, 2) + words[1].substring(0, 2);
    suggestions.push(combo);
  }

  // Add defaults
  suggestions.push('ORD', 'BCI');

  // Remove duplicates and filter valid
  return [...new Set(suggestions)].filter(isValidOrderPrefix).slice(0, 5);
}
