import { z } from 'zod';

export const ProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z
    .string()
    .min(10, 'Valid phone number required')
    .optional()
    .or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof ProfileSchema>;
