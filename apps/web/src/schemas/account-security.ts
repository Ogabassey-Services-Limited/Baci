import z from 'zod';
import {
  checkPasswordStrength,
  isCommonPassword,
  MIN_ACCEPTABLE_PASSWORD_STRENGTH,
} from '@/lib/utils';

const newPasswordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .refine((p) => checkPasswordStrength(p) >= MIN_ACCEPTABLE_PASSWORD_STRENGTH, {
    message:
      'Password is not strong enough. Add more characters or mix letters, numbers, and symbols.',
  })
  .refine((p) => !isCommonPassword(p), {
    message:
      'This password is too common. Please choose a more unique password.',
  });

/** Schema for OAuth-only users setting a password for the first time. */
export const setPasswordSchema = z
  .object({
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

/** Schema for users who already have a password and want to change it. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SetPasswordValues = z.infer<typeof setPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
