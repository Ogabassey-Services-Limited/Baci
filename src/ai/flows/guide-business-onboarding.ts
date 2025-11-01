
'use server';

/**
 * @fileOverview Guides new users through the onboarding process to define their business type and brand preferences.
 *
 * This flow provides two key capabilities:
 * 1. **Logo Generation:** Creates a professional logo and a matching 3-color palette based on business context and user color preferences.
 * 2. **Color Extraction:** Analyzes an existing uploaded logo and extracts a 3-color brand palette from it.
 *
 * Uses Gemini 2.5 Pro Image Preview model for both image generation and analysis.
 *
 * @exports
 * - guideBusinessOnboarding - Main flow function
 * - GuideBusinessOnboardingInput - Input type definition
 * - GuideBusinessOnboardingOutput - Output type definition
 *
 * @aiContext When modifying this flow:
 * 1. DO NOT change input/output schemas without updating callers in onboarding-form.tsx
 * 2. Logo generation prompt is now part of the main flow logic (lines 149-166).
 * 3. Color extraction prompt is separate (`extractColorsPrompt`, lines 109-131).
 * 4. Brand colors MUST always return exactly 3 hex codes in order: primary, secondary, accent.
 * 5. The logic is now split: if a logo is provided, we extract. If not, we generate. This is a critical distinction.
 *
 * @see /src/app/onboarding/onboarding-form.tsx - Caller component
 * @see /src/ai/flows/_AI_README.md for detailed flow documentation
 * @see /docs/adr/001-business-type-journey-architecture.md for business type architecture
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
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
    secondary: z.string().describe('The secondary, complementary color.'),
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

/**
 * Main onboarding flow function - generates logo options or extracts colors.
 */
export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
  return guideBusinessOnboardingFlow(input);
}


const guideBusinessOnboardingFlow = ai.defineFlow(
  {
    name: 'guideBusinessOnboardingFlow',
    inputSchema: GuideBusinessOnboardingInputSchema,
    outputSchema: GuideBusinessOnboardingOutputSchema,
  },
  async input => {
    if (input.task === 'extract_colors') {
      if (!input.logoDataUri) {
        throw new Error('logoDataUri is required for color extraction.');
      }
      logger.info({ message: 'Extracting colors from logo.', flow: 'guideBusinessOnboardingFlow' });

      try {
        const response = await ai.generate({
          model: 'googleai/gemini-pro-vision',
          prompt: [
            {
              text: `Analyze this logo and extract the 3 most representative brand colors. Provide them in a JSON object with keys: "primary", "secondary", and "accent". The primary color should be the most dominant. The accent should be a vibrant color for CTAs. Provide colors in hex format. Return ONLY the JSON object, without any markdown formatting.`,
            },
            {
              media: {
                url: input.logoDataUri,
              },
            },
          ],
        });

        const jsonText = response.text?.trim().replace(/```json|```/g, '');
        if (!jsonText) {
          throw new Error('AI did not return any text for color extraction.');
        }

        const colors = JSON.parse(jsonText);

        // Validate with Zod schema
        const validatedColors = BrandColorsSchema.parse(colors);
        
        logger.info({ message: 'Colors extracted successfully', colors: validatedColors });
        return { brandColors: validatedColors };

      } catch (error) {
        logger.error({ message: 'Color extraction failed', error });
        throw error;
      }
    }

    if (input.task === 'generate_logos') {
      logger.info({ message: 'Generating logo options.', flow: 'guideBusinessOnboardingFlow' });
      
      const businessTypeConfig = getBusinessTypeById(input.businessType);
      const logoStyle = businessTypeConfig?.journey.onboarding.logoStyle || 'simple, modern, and professional';

      const response = await ai.generate({
          model: 'googleai/gemini-2.5-pro-image-preview',
          prompt: [
              {
              text: `Generate 4 unique logo options for a business named "${input.businessName}".
The business is in the "${input.businessType}" sector.
The user's favorite color is "${input.brandPreferences}".

LOGO STYLE GUIDANCE: ${logoStyle}

The logos must be visually distinct but adhere to the same style guidance. They should be suitable for a modern e-commerce brand.
Return 4 images. Do not return any text or JSON, only the raw image outputs.`,
              },
          ],
          config: {
              responseModalities: ['IMAGE'],
              candidates: 4,
          },
      });

      const media = response.media;

      // Handle both single media object and array
      const mediaArray = Array.isArray(media) ? media : (media ? [media] : []);

      if (mediaArray.length < 4) {
        const error = new Error('AI failed to generate 4 logo options.');
        logger.error({ error, message: 'Logo generation failed to produce enough candidates.', flow: 'guideBusinessOnboardingFlow', mediaCount: mediaArray.length, input });
        throw error;
      }

      return {
        logos: mediaArray.map(m => m.url!),
      };
    }
    
    throw new Error('Invalid task provided to guideBusinessOnboardingFlow.');
  }
);
