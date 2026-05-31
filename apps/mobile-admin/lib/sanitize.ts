/**
 * Sanitization utilities for mobile-admin
 * Prevents XSS and injection attacks on user input
 */

import { z } from 'zod';

/**
 * Strips HTML tags from a string by iteratively applying the regex until no more matches.
 * This prevents incomplete sanitization from nested patterns like <scr<script>ipt>.
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

  return result;
}

/**
 * Sanitize plain text (remove HTML, trim, limit length)
 */
export function sanitizeText(text: string, maxLength = 10000): string {
  if (!text) return '';

  // Remove null bytes
  let sanitized = text.replace(/\0/g, '');

  // Remove HTML tags (iteratively to handle nested patterns)
  sanitized = stripHtmlTags(sanitized);

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Sanitize phone number (remove non-numeric characters except +)
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+\-\s()]/g, '').trim();
}

/**
 * Sanitize customer name (for order forms)
 */
export function sanitizeCustomerName(name: string): string {
  return sanitizeText(name, 200);
}

/**
 * Sanitize product description/details
 */
export function sanitizeProductDescription(description: string): string {
  return sanitizeText(description, 5000);
}

/**
 * Sanitize order notes
 */
export function sanitizeNotes(notes: string): string {
  return sanitizeText(notes, 1000);
}

/**
 * Sanitize address field
 */
export function sanitizeAddress(address: string): string {
  return sanitizeText(address, 500);
}

/**
 * Email validation schema with Zod
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .transform((val) => sanitizeEmail(val));

/**
 * Validate email format
 * Returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const result = emailSchema.safeParse(email);
  return result.success;
}

/**
 * Get email validation error message
 * Returns null if valid, error message otherwise
 */
export function getEmailError(email: string): string | null {
  const result = emailSchema.safeParse(email);
  if (result.success) return null;
  // Use .issues for Zod 3.x compatibility (Zod 4 also supports this)
  return result.error.issues[0]?.message ?? 'Invalid email';
}

/**
 * Customer form schema for order creation
 */
export const customerFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200)
    .transform((val) => sanitizeCustomerName(val)),
  email: z
    .email('Invalid email format')
    .transform((val) => sanitizeEmail(val))
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .transform((val) => sanitizePhone(val))
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .max(500)
    .transform((val) => sanitizeAddress(val))
    .optional()
    .or(z.literal('')),
});

/**
 * Custom item schema for order creation
 */
export const customItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(200)
    .transform((val) => sanitizeText(val, 200)),
  price: z.number().min(0, 'Price must be positive'),
  details: z
    .string()
    .max(1000)
    .transform((val) => sanitizeProductDescription(val))
    .optional(),
});

/**
 * Order notes schema
 */
export const orderNotesSchema = z
  .string()
  .max(1000)
  .transform((val) => sanitizeNotes(val))
  .optional();

/**
 * Delivery info schema
 */
export const deliveryInfoSchema = z.object({
  name: z
    .string()
    .max(200)
    .transform((val) => sanitizeCustomerName(val)),
  phone: z.string().transform((val) => sanitizePhone(val)),
  address: z
    .string()
    .max(500)
    .transform((val) => sanitizeAddress(val)),
  city: z
    .string()
    .max(100)
    .transform((val) => sanitizeText(val, 100))
    .optional(),
  state: z
    .string()
    .max(100)
    .transform((val) => sanitizeText(val, 100))
    .optional(),
});

/**
 * Sanitize search query for use in Supabase/PostgREST filters
 * Removes characters that could be used for filter injection in .or() clauses
 * Security: Strips PostgREST control characters (comma, parens, pipe) that can
 * break filter syntax and allow injection of arbitrary filter conditions
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove special characters that could be used for injection
  // Includes PostgREST syntax characters: comma (,), parentheses (()), pipe (|)
  let sanitized = query.replace(/[<>'"`;\\,()|]/g, '');

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 200);

  return sanitized;
}
