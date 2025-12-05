import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Common passwords blocklist (top 100 most common)
 * Based on SecLists and HaveIBeenPwned data
 */
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  '1234567',
  'letmein',
  'trustno1',
  'dragon',
  'baseball',
  'iloveyou',
  'master',
  'sunshine',
  'ashley',
  'bailey',
  'shadow',
  '123123',
  '654321',
  'superman',
  'qazwsx',
  'michael',
  'football',
  'password1',
  'password123',
  'batman',
  'login',
  'welcome',
  'admin',
  'princess',
  'qwerty123',
  '1q2w3e4r',
  'passw0rd',
  '1234567890',
  'welcome1',
  'p@ssw0rd',
  'hello',
  'charlie',
  'donald',
  'password1!',
  'qwerty1',
  '123qwe',
  'zxcvbnm',
  '121212',
  '000000',
  'access',
  'flower',
  'hottie',
  'loveme',
  'zaq1zaq1',
  'password2',
  'killer',
  'soccer',
  'fuckyou',
  'jennifer',
  'hunter',
  'buster',
  'soccer1',
  'hockey',
  'george',
  'andrew',
  'harley',
  'summer',
  'love',
]);

/**
 * Check if password is a common/weak password
 */
export const isCommonPassword = (password: string): boolean => {
  const lower = password.toLowerCase();
  // Check exact match
  if (COMMON_PASSWORDS.has(lower)) return true;
  // Check with common suffixes removed
  const withoutSuffix = lower.replace(/[0-9!@#$%^&*]+$/, '');
  if (COMMON_PASSWORDS.has(withoutSuffix)) return true;
  return false;
};

/**
 * Password strength checker following NIST SP 800-63B guidelines
 *
 * NIST recommendations:
 * - Minimum 8 characters (we use this as baseline)
 * - Longer is better (12+ is strong, 16+ is very strong)
 * - No complexity requirements (they don't help)
 * - Block common passwords
 * - Check against breach databases (done separately)
 *
 * Returns: 0 (none), 1 (weak), 2 (medium), 3 (strong)
 */
export const checkPasswordStrength = (password: string): number => {
  if (!password) return 0;

  const length = password.length;

  // Too short
  if (length < 8) return 0;

  // Check for common passwords (always weak regardless of length)
  if (isCommonPassword(password)) return 1;

  // Check for keyboard patterns and repeated characters
  const hasRepeatingChars = /(.)\1{2,}/.test(password); // aaa, 111
  const hasSequentialChars =
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      password
    );
  const hasKeyboardPattern = /(qwerty|asdf|zxcv|qazwsx|1qaz|2wsx)/i.test(
    password
  );

  // Penalize patterns
  if (hasRepeatingChars || hasSequentialChars || hasKeyboardPattern) {
    if (length < 12) return 1;
    if (length < 16) return 2;
  }

  // Length-based scoring (NIST approach: length is the primary factor)
  if (length >= 16) return 3; // Very strong
  if (length >= 12) return 3; // Strong
  if (length >= 10) return 2; // Medium
  return 1; // 8-9 chars: Weak but acceptable
};

/**
 * Converts a ReadableStream of Uint8Array into a data URI.
 * @param stream The ReadableStream from the AI response.
 * @returns A promise that resolves to a data URI string.
 */

export async function streamToDataURI(
  // biome-ignore lint/suspicious/noExplicitAny: Stream can contain any data
  stream: ReadableStream<any>
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  let mimeType = 'image/png'; // Default MIME type

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (readerDone) {
      done = true;
    } else if (value) {
      // The chunk can be a string (for text parts) or an object with binary data.
      // We are interested in the binary data for the image.
      if (value.image) {
        if (value.image.contentType) {
          mimeType = value.image.contentType;
        }
        chunks.push(value.image.data);
      } else if (value.text) {
        // This handles cases where the model might interleave text and image chunks.
      }
    }
  }

  if (chunks.length === 0) {
    throw new Error('No image data found in the stream.');
  }

  // Concatenate all chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert Uint8Array to a Base64 string
  const base64String = Buffer.from(combined).toString('base64');

  return `data:${mimeType};base64,${base64String}`;
}

/**
 * Determine if text should be black or white based on background color
 * Uses relative luminance formula (Rec. 601)
 */
export function getContrastColor(hexColor: string): 'black' | 'white' {
  // Handle invalid input gracefully
  if (!hexColor || typeof hexColor !== 'string') return 'white';

  // Remove hash if present
  const hex = hexColor.replace('#', '');

  // Handle shorthand hex (e.g. #FFF)
  const fullHex =
    hex.length === 3
      ? hex
        .split('')
        .map((char) => char + char)
        .join('')
      : hex;

  // Parse RGB
  const r = Number.parseInt(fullHex.substring(0, 2), 16);
  const g = Number.parseInt(fullHex.substring(2, 4), 16);
  const b = Number.parseInt(fullHex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * ISO 4217 currency decimal places mapping.
 * Most currencies use 2 decimal places, but some exceptions exist:
 * - Zero-decimal: JPY, KRW, VND, etc.
 * - Three-decimal: BHD, KWD, OMR
 */
const CURRENCY_DECIMALS: Record<string, number> = {
  // Zero-decimal currencies
  JPY: 0, // Japanese Yen
  KRW: 0, // South Korean Won
  VND: 0, // Vietnamese Dong
  CLP: 0, // Chilean Peso
  HUF: 0, // Hungarian Forint (often treated as 0)
  ISK: 0, // Icelandic Króna
  UGX: 0, // Ugandan Shilling
  RWF: 0, // Rwandan Franc
  // Three-decimal currencies
  BHD: 3, // Bahraini Dinar
  KWD: 3, // Kuwaiti Dinar
  OMR: 3, // Omani Rial
};

/**
 * Format currency amount
 * - Takes amount in minor units (kobo/cents) by default
 * - Returns formatted string (e.g., "₦1,000.00")
 * - Correctly handles zero-decimal and three-decimal currencies per ISO 4217
 */
export const formatCurrency = (
  amount: number,
  currencyCode = 'NGN'
): string => {
  // Get decimal places for this currency (default to 2 for most currencies)
  const decimals = CURRENCY_DECIMALS[currencyCode] ?? 2;
  const divisor = Math.pow(10, decimals);
  const majorAmount = amount / divisor;

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0, // No decimals for Naira usually, unless cents are critical
  }).format(majorAmount);
};
