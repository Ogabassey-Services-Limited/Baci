'use server';

import { generateObject, experimental_generateImage } from 'ai';
import { geminiFlash, imagen3, withRetry, sanitizePromptInput } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';


const _GuideBusinessOnboardingInputSchema = z.object({
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
type GuideBusinessOnboardingInput = z.infer<typeof _GuideBusinessOnboardingInputSchema>;

const BrandColorsSchema = z.object({
  primary: z.string().describe('The primary color, most dominant in the logo.'),
  background: z.string().describe('The background color, should be light and suitable for a page background. Prefer white or off-white.'),
  accent: z.string().describe('An accent color for highlights and calls-to-action.'),
});
type _BrandColors = z.infer<typeof BrandColorsSchema>;

const _GuideBusinessOnboardingOutputSchema = z.object({
  logos: z
    .array(z.string())
    .optional()
    .describe(
      'An array of data URIs for the generated logos.'
    ),
  brandColors: BrandColorsSchema.optional().describe('A list of 3 brand colors in hex format (e.g., #RRGGBB).'),
});
type GuideBusinessOnboardingOutput = z.infer<typeof _GuideBusinessOnboardingOutputSchema>;

export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
  if (input.task === 'extract_colors') {
    if (!input.logoDataUri) {
      throw new Error('logoDataUri is required for color extraction.');
    }
    logger.info({ message: 'Extracting colors from logo.', flow: 'guideBusinessOnboarding' });

    try {
      const { object } = await withRetry(async () => {
        return await generateObject({
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
                { type: 'image', image: input.logoDataUri! }
              ]
            }
          ]
        });
      });

      logger.info({ message: 'Colors extracted successfully', colors: object });
      return { brandColors: object };

    } catch (error) {
      logger.error({ message: 'Color extraction failed', error });
      throw new Error('Failed to extract brand colors.');
    }
  }

  if (input.task === 'generate_logos') {
    logger.info({ message: 'Generating logo with Imagen 3', flow: 'guideBusinessOnboarding' });

    // Sanitize user inputs
    const businessName = sanitizePromptInput(input.businessName, 100);
    const businessType = sanitizePromptInput(input.businessType, 50);
    const brandPreferences = sanitizePromptInput(input.brandPreferences, 50);

    try {
      const prompt = `Design a professional, modern, and minimalist logo for a business named "${businessName}".
      Business Type: ${businessType}.
      Color Preferences: ${brandPreferences}.
      Style: Clean, vector-like, suitable for a website header and app icon.
      Ensure high contrast and simple shapes. White background.`;

      // Note: imagen3 is an image generation model from @ai-sdk/google
      // Using type assertion due to experimental API
      const { image } = await withRetry(async () => {
        return await experimental_generateImage({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: imagen3 as any,
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          aspectRatio: '1:1',
        });
      });

      if (!image) {
        throw new Error('No image generated.');
      }

      const logoDataUri = `data:image/png;base64,${image.base64}`;

      return { logos: [logoDataUri] };

    } catch (error) {
      logger.error({ message: 'Logo generation failed', error });
      // Return empty array to handle gracefully in UI, or throw if preferred
      throw new Error('Failed to generate logo.');
    }
  }

  throw new Error('Invalid task provided to guideBusinessOnboarding.');
}
