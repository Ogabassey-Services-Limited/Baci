import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize-core';

export const reorderSuggestionActionSchema = z.object({
  suggestionId: z
    .string()
    .uuid()
    .transform((val) => sanitizeText(val, 50)),
  action: z.enum(['accept', 'reject', 'ordered']),
  orderedQuantity: z.number().int().min(1).optional(),
});

export type ReorderSuggestionActionInput = z.infer<
  typeof reorderSuggestionActionSchema
>;

/**
 * Helper to format Zod errors for API responses
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}
