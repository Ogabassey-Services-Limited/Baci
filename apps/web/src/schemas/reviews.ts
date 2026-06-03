import { z } from 'zod';
import { sanitizeEmail, sanitizeText } from '@/lib/sanitize-core';

/**
 * Review Submission Schema
 *
 * Validates and sanitizes review submissions.
 * Text fields are sanitized to prevent XSS.
 */
export const reviewSubmissionSchema = z.object({
  productId: z.uuid('Invalid product ID'),
  merchantId: z.uuid('Invalid merchant ID'),
  customerEmail: z
    .email('Invalid email format')
    .max(254, 'Email too long')
    .transform(sanitizeEmail),
  customerName: z
    .string()
    .max(100, 'Name too long')
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val, 100) : val)),
  rating: z
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  title: z
    .string()
    .max(200, 'Title too long')
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val, 200) : val)),
  body: z
    .string()
    .max(5000, 'Review body too long')
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val, 5000) : val)),
});

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
