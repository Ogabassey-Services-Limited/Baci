import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
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
    address: optionalText(240),
    city: optionalText(120),
    state: optionalText(120),
    phone: optionalText(32),
    managerId: z.string().uuid('Invalid branch manager').optional(),
    isDefault: z.boolean().default(false),
  })
  .strict();

export const branchUpdateSchema = z
  .object({
    name: branchNameSchema.optional(),
    address: optionalText(240),
    city: optionalText(120),
    state: optionalText(120),
    phone: optionalText(32),
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
