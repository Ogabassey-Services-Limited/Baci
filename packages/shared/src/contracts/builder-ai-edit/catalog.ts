import { z } from 'zod';
import { componentPatchSchema } from './content';
import { MAX_AI_LABEL_LENGTH } from './limits';

function requiresEditableField<T extends { componentType: string }>(
  value: T
): boolean {
  return Object.keys(value).some((key) => key !== 'componentType');
}

export const productGridPatchSchema = z
  .strictObject({
    columns: z.number().int().min(1).max(4).optional(),
    componentType: z.literal('ProductGrid'),
    limit: z.number().int().min(1).max(24).optional(),
    showFilters: z.boolean().optional(),
    sortBy: z.enum(['newest', 'price-low', 'price-high', 'name']).optional(),
    title: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH).optional(),
  })
  .refine(
    requiresEditableField,
    'Expected at least one editable product grid field'
  );

export const insertableComponentSchema = z.discriminatedUnion('componentType', [
  componentPatchSchema,
  productGridPatchSchema,
]);
