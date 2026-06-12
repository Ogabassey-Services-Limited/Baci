import { z } from 'zod';

const MAX_BUSINESS_NAME_LENGTH = 200;
const MAX_BUSINESS_TYPE_LENGTH = 100;
const MAX_BRAND_PREFERENCES_LENGTH = 100;
const MAX_LOGO_URL_LENGTH = 2048;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TONE_LENGTH = 50;

export const guideBusinessOnboardingInputSchema = z.object({
  businessName: z
    .string()
    .max(MAX_BUSINESS_NAME_LENGTH)
    .describe("The user's business name."),
  businessType: z
    .string()
    .max(MAX_BUSINESS_TYPE_LENGTH)
    .describe('The type of business the user is onboarding.'),
  brandPreferences: z
    .string()
    .max(MAX_BRAND_PREFERENCES_LENGTH)
    .describe("The user's favorite color to influence branding."),
  logoUrl: z
    .string()
    .url()
    .max(MAX_LOGO_URL_LENGTH)
    .optional()
    .describe(
      'A URL to a company logo, which will be used for color extraction.'
    ),
  task: z
    .enum(['generate_logos', 'extract_colors', 'generate_names'])
    .describe('The specific task for the flow to perform.'),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH)
    .optional()
    .describe('Business description for name generation.'),
  tone: z
    .string()
    .max(MAX_TONE_LENGTH)
    .optional()
    .describe('Desired tone for business name generation.'),
});
