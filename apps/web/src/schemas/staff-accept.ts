import { z } from 'zod';

export const staffAcceptSchema = z.object({
  token: z.preprocess(
    (value) => (value == null ? '' : value),
    z
      .string()
      .min(1, 'Invitation token is required')
      .max(255, 'Invalid invitation token format')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid invitation token characters')
  ),
});
