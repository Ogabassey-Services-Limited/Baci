import { z } from 'zod';
import { normalizeProductSelectionParamKey } from '../lib/product-selection-params';
import { compareCodePointStrings } from './compare-code-point-strings';

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
    const normalizedKeys = Object.keys(attributes).map(
      normalizeProductSelectionParamKey
    );
    if (Object.keys(attributes).length > 32)
      context.addIssue({
        code: 'custom',
        message: 'Product variant attributes must contain at most 32 axes',
      });
    if (normalizedKeys.some((key) => key === 'condition'))
      context.addIssue({
        code: 'custom',
        message: 'Product variant condition must use the typed condition field',
      });
    if (new Set(normalizedKeys).size !== normalizedKeys.length)
      context.addIssue({
        code: 'custom',
        message: 'Product variant attribute axes must be canonically unique',
      });
  })
  .transform((attributes) =>
    Object.fromEntries(
      Object.entries(attributes).sort(
        ([left], [right]) =>
          compareCodePointStrings(
            normalizeProductSelectionParamKey(left),
            normalizeProductSelectionParamKey(right)
          ) || compareCodePointStrings(left, right)
      )
    )
  );
const SelectionAxesSchema = z
  .array(SelectionAxisSchema)
  .max(32)
  .superRefine((axes, context) => {
    const normalizedAxes = axes.map(normalizeProductSelectionParamKey);
    if (normalizedAxes.some((axis) => axis === 'condition'))
      context.addIssue({
        code: 'custom',
        message: 'Product condition must use the typed condition field',
      });
    if (new Set(normalizedAxes).size !== normalizedAxes.length)
      context.addIssue({
        code: 'custom',
        message: 'Product attribute axes must be canonically unique',
      });
  })
  .transform((axes) => axes.map(normalizeProductSelectionParamKey));

/** Bounded parent selection metadata used when variant rows are incomplete. */
export const StorefrontPublicProductSelectionFieldsSchema = z.strictObject({
  variantAttributes: ParentVariantAttributesSchema.nullable().optional(),
  storageOptions: z.array(SelectionOptionSchema).max(64).nullable().optional(),
  attributeAxes: SelectionAxesSchema.nullable().optional(),
});
