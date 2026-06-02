import { z } from 'zod';

export const reorderSuggestionActionSchema = z
  .object({
    suggestionId: z.uuid(),
    action: z.enum(['accept', 'reject', 'ordered']),
    orderedQuantity: z.int().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'ordered') {
        return data.orderedQuantity !== undefined;
      }
      return true;
    },
    {
      path: ['orderedQuantity'],
      error: "orderedQuantity is required when action is 'ordered'",
    }
  );
