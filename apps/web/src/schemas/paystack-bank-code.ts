import { z } from 'zod';

/**
 * Shared validator for Paystack bank codes.
 *
 * Paystack Nigeria bank codes are not uniformly numeric or 3 digits.
 * Real examples include: 09, 035A, FC40163, MFB50992, 999992, 50211, 00zap.
 * This schema accepts trimmed alphanumeric strings 2–16 characters long,
 * rejecting whitespace, punctuation, and obvious garbage while remaining
 * compatible with all known Paystack code formats.
 */
export const paystackBankCodeSchema = z
  .string()
  .trim()
  .min(2, 'Bank code is required')
  .max(16, 'Bank code is invalid')
  .regex(/^[A-Za-z0-9]+$/, 'Bank code is invalid');

export type PaystackBankCode = z.infer<typeof paystackBankCodeSchema>;
