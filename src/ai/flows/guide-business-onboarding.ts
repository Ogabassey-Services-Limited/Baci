
'use server';

/**
 * @fileOverview Guides new users through the onboarding process to define their business type and brand preferences.
 *
 * This flow provides two key capabilities:
 * 1. **Logo Generation:** Creates professional logo options and a matching 3-color palette based on business context and user color preferences.
 * 2. **Color Extraction:** Analyzes an existing uploaded logo and extracts a 3-color brand palette from it.
 *
 * Uses Gemini 1.5 Flash model for both image generation and analysis.
 *
 * @exports
 * - guideBusinessOnboarding - Main flow function
 * - GuideBusinessOnboardingInput - Input type definition
 * - GuideBusinessOnboardingOutput - Output type definition
 *
 * @aiContext When modifying this flow:
 * 1. DO NOT change input/output schemas without updating callers in onboarding-form.tsx
 * 2. Logic is now split by a `task` field: 'generate_logos' or 'extract_colors'. This is a critical distinction.
 * 3. Brand colors MUST always return exactly 3 hex codes in order: primary, background, accent.
 *
 * @see /src/app/onboarding/onboarding-form.tsx - Caller component
 * @see /src/ai/flows/_AI_README.md for detailed flow documentation
 * @see /docs/adr/001-business-type-journey-architecture.md for business type architecture
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
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
    background: z.string().describe('The background color, should be light and suitable for a page background.'),
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

const extractColorsPrompt = ai.definePrompt({
    name: 'extractColorsPrompt',
    input: { schema: z.object({ logoDataUri: z.string() }) },
    output: { schema: BrandColorsSchema },
    prompt: `You are a professional brand designer analyzing a logo image.

TASK: Extract exactly 3 brand colors from this logo in hex format.

INSTRUCTIONS:
1. Primary color = The MOST DOMINANT color in the logo (usually the main brand color)
2. Background color = A LIGHT, neutral color from the logo suitable for a page background. If no light color exists, generate a compatible light grey or off-white.
3. Accent color = A complementary or highlight color that stands out from the primary color.

IMPORTANT:
- Look at the actual colors IN THE LOGO IMAGE.
- Return colors as they appear in the logo, not imagined colors, unless a background color must be generated.
- Ensure the background color is light enough for good readability.

Return ONLY the JSON object with primary, background, and accent hex codes.`,
});

async function guideBusinessOnboardingFlow(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
    if (input.task === 'extract_colors') {
      if (!input.logoDataUri) {
        throw new Error('logoDataUri is required for color extraction.');
      }
      logger.info({ message: 'Extracting colors from logo.', flow: 'guideBusinessOnboardingFlow' });

      try {
        const { output } = await extractColorsPrompt({ logoDataUri: input.logoDataUri });
        
        if (!output) {
            throw new Error('AI failed to extract brand colors.');
        }

        logger.info({ message: 'Colors extracted successfully', colors: output });
        return { brandColors: output };

      } catch (error) {
        logger.error({ message: 'Color extraction failed', error });
        throw error;
      }
    }

    if (input.task === 'generate_logos') {
      logger.info({ message: 'Generating logo options.', flow: 'guideBusinessOnboardingFlow' });
      
      const businessTypeConfig = getBusinessTypeById(input.businessType);
      const logoStyle = businessTypeConfig?.journey.onboarding.logoStyle || 'simple, modern, and professional';

      const prompt = `Generate 4 unique logo options for a business named "${input.businessName}".
The business is in the "${input.businessType}" sector.
The user's favorite color is "${input.brandPreferences}".

LOGO STYLE GUIDANCE: ${logoStyle}

The logos must be visually distinct but adhere to the same style guidance. They should be suitable for a modern e-commerce brand.
Return 4 images. Do not return any text or JSON, only the raw image outputs.`;

      const { media } = await ai.generate({
          prompt,
          model: 'googleai/gemini-1.5-flash-latest',
          config: { responseModalities: ['IMAGE'] },
          output: {
              format: 'media'
          }
      });
      
      const logos = media.map(m => m.url);

      if (logos.length < 4) {
        const error = new Error('AI failed to generate 4 logo options.');
        logger.error({ error, message: 'Logo generation failed to produce enough candidates.', flow: 'guideBusinessOnboardingFlow', mediaCount: logos.length, input });
        throw error;
      }

      return { logos };
    }
    
    throw new Error('Invalid task provided to guideBusinessOnboardingFlow.');
}

export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
    return guideBusinessOnboardingFlow(input);
}
