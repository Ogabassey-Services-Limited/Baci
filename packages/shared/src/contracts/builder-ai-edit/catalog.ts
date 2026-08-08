import { z } from 'zod';
import { componentPatchSchema } from './content';
import { MAX_AI_LABEL_LENGTH } from './limits';

function requiresEditableField<T extends { componentType: string }>(
  value: T
): boolean {
  return Object.keys(value).some((key) => key !== 'componentType');
}

const productGridFields = {
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  componentType: z.literal('ProductGrid'),
  limit: z.number().int().min(1).max(24).optional(),
  showFilters: z.boolean().optional(),
  title: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH).optional(),
};

export const productGridPatchSchema = z
  .strictObject(productGridFields)
  .refine(
    requiresEditableField,
    'Expected at least one editable product grid field'
  );

export const insertableComponentSchema = z.discriminatedUnion('componentType', [
  componentPatchSchema,
  z.strictObject(productGridFields),
]);
