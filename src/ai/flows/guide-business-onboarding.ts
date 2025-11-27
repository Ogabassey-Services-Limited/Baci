'use server';

import { generateObject, generateText } from 'ai';
import { geminiFlash, gemini25FlashImage, withRetry, sanitizePromptInput } from '@/ai/provider';
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

/**
 * Orchestrates AI-driven onboarding tasks to either extract brand colors from a provided logo or generate logo images for a business.
 *
 * @param input - Input object guiding the operation. For `task: "extract_colors"` `logoDataUri` must be provided; for `task: "generate_logos"` `businessName`, `businessType`, and `brandPreferences` are used to build the generation prompt.
 * @returns An object with `brandColors` when `task` is `"extract_colors"`, or `logos` (an array of image data URIs) when `task` is `"generate_logos"`.
 * @throws Error when `logoDataUri` is missing for color extraction.
 * @throws Error when color extraction fails.
 * @throws Error when no image is produced during logo generation.
 * @throws Error when logo generation fails for any other reason.
 * @throws Error when `input.task` is not a supported task.
 */
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
    logger.info({ message: 'Generating logo with Gemini 2.5 Flash Image', flow: 'guideBusinessOnboarding' });

    // Sanitize user inputs
    const businessName = sanitizePromptInput(input.businessName, 100);
    const businessType = sanitizePromptInput(input.businessType, 50);
    const brandPreferences = sanitizePromptInput(input.brandPreferences, 50);

    try {
      const prompt = `Generate a professional, modern, and minimalist logo image for a business.

Business Name: "${businessName}"
Business Type: ${businessType}
Color Preferences: ${brandPreferences}

Requirements:
- Clean, vector-like design suitable for a website header and app icon
- High contrast with simple, recognizable shapes
- White or transparent background
- Professional and memorable
- The logo should work well at both large and small sizes

Please generate the logo image now.`;

      // Use Gemini 2.5 Flash Image with native image generation
      const result = await withRetry(async () => {
        return await generateText({
          model: gemini25FlashImage,
          prompt: prompt,
          providerOptions: {
            google: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          },
        });
      });

      // Extract image from response files
      const imageFile = result.files?.find(f => f.mediaType?.startsWith('image/'));

      if (!imageFile || !imageFile.base64) {
        logger.error({ message: 'No image in response', files: result.files });
        throw new Error('No image generated.');
      }

      const mediaType = imageFile.mediaType || 'image/png';
      const logoDataUri = `data:${mediaType};base64,${imageFile.base64}`;

      logger.info({ message: 'Logo generated successfully with Gemini 2.5 Flash Image' });
      return { logos: [logoDataUri] };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ message: 'Logo generation failed', error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
      console.error('Logo generation error details:', error);
      throw new Error(`Failed to generate logo: ${errorMessage}`);
    }
  }

  throw new Error('Invalid task provided to guideBusinessOnboarding.');
}