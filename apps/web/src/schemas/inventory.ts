import { z } from 'zod';

export const reorderSuggestionActionSchema = z
  .object({
    suggestionId: z.string().uuid(),
    action: z.enum(['accept', 'reject', 'ordered']),
    orderedQuantity: z.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.action === 'ordered' &&
      (data.orderedQuantity === undefined || data.orderedQuantity === null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'orderedQuantity is required when action is "ordered"',
        path: ['orderedQuantity'],
      });
    }
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
