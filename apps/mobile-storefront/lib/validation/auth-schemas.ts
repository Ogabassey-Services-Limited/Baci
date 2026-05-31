import { z } from 'zod';

export const EmailSchema = z
  .string()
  .min(1, 'Email address is required')
  .email('Please enter a valid email address')
  .max(255, 'Email is too long');

export const OtpSchema = z
  .string()
  .length(6, 'Verification code must be 6 digits')
  .regex(/^\d{6}$/, 'Verification code must be numbers only');

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long');

const NigerianPhoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine(
    (phone) => {
      const cleaned = phone.replace(/[\s\-().]/g, '');
      const patterns = [
        /^0[789][01]\d{8}$/,
        /^\+234[789][01]\d{8}$/,
        /^234[789][01]\d{8}$/,
        /^[789][01]\d{8}$/,
      ];
      return patterns.some((pattern) => pattern.test(cleaned));
    },
    {
      message: 'Please enter a valid Nigerian phone number (e.g., 08012345678)',
    }
  );

export const OptionalNigerianPhoneSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, NigerianPhoneSchema.optional());

export const ProfileSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name is too long'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name is too long'),
  phone: OptionalNigerianPhoneSchema,
});

export { NigerianPhoneSchema };
