import z from 'zod';

export const loginSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address.' }),
  password: z.string().min(1, 'Please enter your password.'),
});

export const signupSchema = z
  .object({
    email: z.email({ error: 'Please enter a valid email address' }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address.' }),
});

export type SignupValues = z.infer<typeof signupSchema>;

export const storefrontAuthAudienceSchema = z
  .enum(['storefront-web', 'native'])
  .default('storefront-web');

export const sendCodeSchema = z.object({
  audience: storefrontAuthAudienceSchema,
  captchaToken: z.string().trim().min(1).max(4096).optional(),
  email: z
    .email({ error: 'Please enter a valid email address.' })
    .max(254, 'Email too long'),
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
});

export const verifyCodeSchema = z.object({
  audience: storefrontAuthAudienceSchema,
  captchaToken: z.string().trim().min(1).max(4096).optional(),
  email: z.email({ error: 'Please enter a valid email address.' }),
  token: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
});

export type SendCodeValues = z.infer<typeof sendCodeSchema>;
export type VerifyCodeValues = z.infer<typeof verifyCodeSchema>;

export const merchantPasswordlessSendSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address.' }),
  redirectTo: z.string().optional(),
});

export const merchantPasswordlessVerifySchema = z.object({
  email: z.email({ error: 'Please enter a valid email address.' }),
  redirectTo: z.string().optional(),
  token: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export type MerchantPasswordlessSendValues = z.infer<
  typeof merchantPasswordlessSendSchema
>;
export type MerchantPasswordlessVerifyValues = z.infer<
  typeof merchantPasswordlessVerifySchema
>;
