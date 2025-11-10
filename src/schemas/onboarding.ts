import { z } from 'zod';
import { checkPasswordStrength } from '@/lib/utils';

/**
 * Base schema for Step 1. Contains only field definitions.
 */
const step1BaseSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
});

/**
 * Step 1: Business Details (with client-side refinement)
 */
export const step1Schema = step1BaseSchema.refine(data => {
    if (data.businessType === 'other' && (!data.otherBusinessType || data.otherBusinessType.length < 2)) {
      return false;
    }
    return true;
  }, {
    message: "If you select 'Other', please specify your business type with at least 2 characters.",
    path: ["otherBusinessType"],
});


/**
 * Step 2: Branding (Client-side validation)
 */
export const step2Schema = z.object({
  logoDataUri: z.string().min(1, 'Logo is required. Please upload or generate one.'),
  brandColors: z.string().min(1, 'Brand colors are required.'),
  brandPreferences: z.string().optional(),
});


/**
 * Base schema for Step 3. Contains only field definitions.
 */
const step3BaseSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.union([z.string().min(8, "Password must be at least 8 characters."), z.literal('')]).optional(),
  confirmPassword: z.string().optional(),
});

/**
 * Step 3: Account Creation (with client-side refinement)
 */
export const step3Schema = step3BaseSchema.refine(data => {
  if (data.password && checkPasswordStrength(data.password || '') >= 3) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});


/**
 * Combined schema for final server-side validation.
 * This merges the base schemas first, then applies all refinements.
 */
export const onboardingSchema = step1BaseSchema
  .merge(step2Schema)
  .merge(step3BaseSchema)
  .refine(data => { // Refinement from step1Schema
    if (data.businessType === 'other' && (!data.otherBusinessType || data.otherBusinessType.length < 2)) {
      return false;
    }
    return true;
  }, {
    message: "If you select 'Other', please specify your business type.",
    path: ["otherBusinessType"],
  })
  .refine(data => { // Refinement from step3Schema
    if (data.password) {
      return data.password === data.confirmPassword;
    }
    return true;
  }, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
