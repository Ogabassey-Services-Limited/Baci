import { z } from 'zod';

export const reorderSuggestionActionSchema = z
  .object({
    suggestionId: z.string().uuid(),
    action: z.enum(['accept', 'reject', 'ordered']),
    orderedQuantity: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'ordered') {
        return data.orderedQuantity !== undefined;
      }
      return true;
    },
    {
      message: "orderedQuantity is required when action is 'ordered'",
      path: ['orderedQuantity'],
    }
  );
