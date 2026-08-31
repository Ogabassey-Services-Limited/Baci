import { z } from 'zod';

const SelectionAxisSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => value.trim() === value);
const SelectionOptionSchema = z
  .string()
  .min(1)
  .max(160)
  .refine((value) => value.trim() === value);
const ParentVariantAttributesSchema = z
  .record(SelectionAxisSchema, z.array(SelectionOptionSchema).max(64))
  .superRefine((attributes, context) => {
    if (Object.keys(attributes).length > 32)
      context.addIssue({
        code: 'custom',
        message: 'Product variant attributes must contain at most 32 axes',
      });
  });
const SelectionAxesSchema = z
  .array(SelectionAxisSchema)
  .max(32)
  .superRefine((axes, context) => {
    if (new Set(axes).size !== axes.length)
      context.addIssue({
        code: 'custom',
        message: 'Product attribute axes must be unique',
      });
  });

/** Bounded parent selection metadata used when variant rows are incomplete. */
export const StorefrontPublicProductSelectionFieldsSchema = z.strictObject({
  variantAttributes: ParentVariantAttributesSchema.nullable().optional(),
  storageOptions: z.array(SelectionOptionSchema).max(64).nullable().optional(),
  attributeAxes: SelectionAxesSchema.nullable().optional(),
});
