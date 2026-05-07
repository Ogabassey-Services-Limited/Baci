import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalNullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const BranchSchema = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().nullable(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  phone: z.string().nullable(),
  manager_id: z.string().uuid().nullable(),
  is_default: z.boolean(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});

export const CreateBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    address: optionalText(240),
    city: optionalText(120),
    state: optionalText(120),
    phone: optionalText(32),
    managerId: z.string().uuid().optional(),
    isDefault: z.boolean().default(false),
  })
  .strict();

export const UpdateBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    address: optionalNullableText(240),
    city: optionalNullableText(120),
    state: optionalNullableText(120),
    phone: optionalNullableText(32),
    managerId: z.string().uuid().nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one branch field is required',
  });

export const BranchScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('branch'), branchId: z.string().uuid() }),
]);

export type Branch = z.infer<typeof BranchSchema>;
export type CreateBranchInput = z.input<typeof CreateBranchSchema>;
export type UpdateBranchInput = z.input<typeof UpdateBranchSchema>;
export type BranchScope = z.infer<typeof BranchScopeSchema>;

export const ALL_BRANCH_SCOPE: BranchScope = { type: 'all' };

export function serializeBranchScope(scope: BranchScope): string | null {
  return scope.type === 'branch' ? scope.branchId : null;
}

export function parsePersistedBranchScope(value: string | null): BranchScope {
  if (!value) {
    return ALL_BRANCH_SCOPE;
  }

  const parsed = BranchScopeSchema.safeParse({
    type: 'branch',
    branchId: value,
  });

  return parsed.success ? parsed.data : ALL_BRANCH_SCOPE;
}
