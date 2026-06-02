import { z } from 'zod';

export const domainRegex = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;

export const createDomainSchema = z.object({
  domain: z
    .string()
    .min(1)
    .refine((value) => domainRegex.test(value), {
      error: 'Invalid domain format',
    }),
  isPrimary: z.boolean().optional().default(false),
});

export type CreateDomainInput = z.infer<typeof createDomainSchema>;
