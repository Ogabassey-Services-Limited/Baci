import { z } from 'zod';
import { checkPasswordStrength } from '@/lib/utils';

/**
 * Step 1: Business Details
 */
export const step1Schema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
}).refine(data => {
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
 * Step 3: Account Creation
 */
export const step3Schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, "Password must be at least 8 characters.").optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
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
 */
export const onboardingSchema = step1Schema.merge(step2Schema).merge(step3Schema);

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
