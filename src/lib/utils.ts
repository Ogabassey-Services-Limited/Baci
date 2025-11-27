import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combine multiple class value inputs into a single string and resolve Tailwind class conflicts.
 *
 * @param inputs - One or more class values (strings, arrays, objects, etc.) to be combined
 * @returns A single className string with Tailwind utility classes merged and conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Common passwords blocklist (top 100 most common)
 * Based on SecLists and HaveIBeenPwned data
 */
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'shadow', '123123', '654321', 'superman', 'qazwsx',
  'michael', 'football', 'password1', 'password123', 'batman', 'login',
  'welcome', 'admin', 'princess', 'qwerty123', '1q2w3e4r', 'passw0rd',
  '1234567890', 'welcome1', 'p@ssw0rd', 'hello', 'charlie', 'donald',
  'password1!', 'qwerty1', '123qwe', 'zxcvbnm', '121212', '000000',
  'access', 'flower', 'hottie', 'loveme', 'zaq1zaq1', 'password2',
  'killer', 'soccer', 'fuckyou', 'jennifer', 'hunter', 'buster',
  'soccer1', 'hockey', 'george', 'andrew', 'harley', 'summer', 'love',
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
  const hasSequentialChars = /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password);
  const hasKeyboardPattern = /(qwerty|asdf|zxcv|qazwsx|1qaz|2wsx)/i.test(password);

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function streamToDataURI(stream: ReadableStream<any>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  let mimeType = 'image/png'; // Default MIME type

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (readerDone) {
      done = true;
    } else {
      // The chunk can be a string (for text parts) or an object with binary data.
      // We are interested in the binary data for the image.
      if (value.image) {
        if (value.image.contentType) {
          mimeType = value.image.contentType;
        }
        chunks.push(value.image.data);
      } else if (value.text) {
        // This handles cases where the model might interleave text and image chunks.
        // We are primarily interested in the image.
      }
    }
  }

  if (chunks.length === 0) {
    throw new Error("No image data found in the stream.");
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