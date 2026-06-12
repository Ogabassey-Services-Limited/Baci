import z from 'zod';

export const onboardingMagicLinkSchema = z.object({
  email: z
    .email({ error: 'Please enter a valid email address.' })
    .max(254, 'Email address is too long.'),
});
