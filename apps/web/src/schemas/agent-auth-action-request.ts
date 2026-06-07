import { z } from 'zod';

const claimRequestSchema = z
  .strictObject({
    action: z.literal('claim'),
    email: z.string().trim().pipe(z.email()).optional(),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'OTP must be 6 digits')
      .optional(),
    registration_id: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => value.email !== undefined || value.registration_id !== undefined,
    {
      message: 'email or registration_id is required',
    }
  );

const revokeRequestSchema = z
  .strictObject({
    action: z.literal('revoke'),
    logout_token: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).max(256).optional(),
    registration_id: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.logout_token !== undefined || value.registration_id !== undefined,
    {
      message: 'logout_token or registration_id is required',
    }
  );

export const agentAuthActionRequestSchema = z.union([
  claimRequestSchema,
  revokeRequestSchema,
]);
