'use server';

import { generateObject } from 'ai';
import { geminiFlash } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getBusinessTypeById } from '@/config/business-types';

const GuideBusinessOnboardingInputSchema = z.object({
  businessName: z.string().describe("The user's business name."),
  businessType: z.string().describe('The type of business the user is onboarding.'),
  brandPreferences: z.string().describe("The user's favorite color to influence branding."),
  logoDataUri: z
    .string()
    .optional()
    .describe(
      "A photo of a company logo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  task: z.enum(['generate_logos', 'extract_colors']).describe("The specific task for the flow to perform."),
});
export type GuideBusinessOnboardingInput = z.infer<typeof GuideBusinessOnboardingInputSchema>;

const BrandColorsSchema = z.object({
  primary: z.string().describe('The primary color, most dominant in the logo.'),
  background: z.string().describe('The background color, should be light and suitable for a page background. Prefer white or off-white.'),
  accent: z.string().describe('An accent color for highlights and calls-to-action.'),
});
export type BrandColors = z.infer<typeof BrandColorsSchema>;

const GuideBusinessOnboardingOutputSchema = z.object({
  logos: z
    .array(z.string())
    .optional()
    .describe(
      'An array of data URIs for the generated logos.'
    ),
  brandColors: BrandColorsSchema.optional().describe('A list of 3 brand colors in hex format (e.g., #RRGGBB).'),
});
export type GuideBusinessOnboardingOutput = z.infer<typeof GuideBusinessOnboardingOutputSchema>;

export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
  if (input.task === 'extract_colors') {
    if (!input.logoDataUri) {
      throw new Error('logoDataUri is required for color extraction.');
    }
    logger.info({ message: 'Extracting colors from logo.', flow: 'guideBusinessOnboarding' });

    try {
      const { object } = await generateObject({
        model: geminiFlash,
        schema: BrandColorsSchema,
        messages: [
          {
            role: 'system',
            content: `You are a professional brand designer analyzing a logo image.
TASK: Extract exactly 3 brand colors from this logo in hex format.
INSTRUCTIONS:
1. Primary color = The MOST DOMINANT color in the logo (usually the main brand color).
2. Background color = A LIGHT, neutral color. Prefer pure white (#FFFFFF) or a very light off-white/grey from the logo that is suitable for a page background.
3. Accent color = A complementary or highlight color that stands out from the primary color.
IMPORTANT:
- Look at the actual colors IN THE LOGO IMAGE.
- Return colors as they appear in the logo, unless a background color must be generated.
- Ensure the background color is very light for good readability.`
          },
          {
            role: 'user',
            content: [
              { type: 'image', image: input.logoDataUri }
            ]
          }
        ]
      });

      logger.info({ message: 'Colors extracted successfully', colors: object });
      return { brandColors: object };

    } catch (error) {
      logger.error({ message: 'Color extraction failed', error });
      throw new Error('Failed to extract brand colors.');
    }
  }

  if (input.task === 'generate_logos') {
    logger.warn({ message: 'Logo generation requested but currently disabled/placeholder.', flow: 'guideBusinessOnboarding' });

    // Placeholder: Return empty array or throw. 
    // Since we can't generate images with Gemini 1.5 Flash text model, we return empty to avoid errors.
    // The UI should handle empty logos gracefully or we can throw a specific error.

    return { logos: [] };
  }

  throw new Error('Invalid task provided to guideBusinessOnboarding.');
}
