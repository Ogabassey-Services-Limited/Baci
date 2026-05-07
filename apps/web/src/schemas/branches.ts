import { z } from 'zod';

const optionalCreateText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

const optionalUpdateText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const branchNameSchema = z
  .string()
  .trim()
  .min(2, 'Branch name must be at least 2 characters')
  .max(120, 'Branch name must be at most 120 characters');

export const branchIdParamSchema = z.object({
  id: z.string().uuid('Invalid branch id'),
});

export const requestedMerchantIdSchema = z.string().uuid('Invalid merchant id');

export const branchCreateSchema = z
  .object({
    name: branchNameSchema,
    address: optionalCreateText(240),
    city: optionalCreateText(120),
    state: optionalCreateText(120),
    phone: optionalCreateText(32),
    managerId: z.string().uuid('Invalid branch manager').optional(),
    isDefault: z.boolean().default(false),
  })
  .strict();

export const branchUpdateSchema = z
  .object({
    name: branchNameSchema.optional(),
    address: optionalUpdateText(240),
    city: optionalUpdateText(120),
    state: optionalUpdateText(120),
    phone: optionalUpdateText(32),
    managerId: z.string().uuid('Invalid branch manager').nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: 'At least one branch field is required',
    }
  );

export type BranchCreateInput = z.infer<typeof branchCreateSchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;
