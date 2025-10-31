'use server';

/**
 * @fileOverview Guides new users through the onboarding process to define their business type and brand preferences.
 *
 * This flow provides two key capabilities:
 * 1. **Logo Generation:** Creates a professional logo based on business context and color preferences
 * 2. **Color Extraction:** Analyzes uploaded logos and extracts a 5-color brand palette
 *
 * The flow uses Gemini 2.5 Flash Image Preview model for both image generation and analysis.
 *
 * @exports
 * - guideBusinessOnboarding - Main flow function
 * - GuideBusinessOnboardingInput - Input type definition
 * - GuideBusinessOnboardingOutput - Output type definition
 *
 * @aiContext When modifying this flow:
 * 1. DO NOT change input/output schemas without updating callers in onboarding-form.tsx
 * 2. Logo generation prompt is at lines 166-174 (inline, with config guidance)
 * 3. Color extraction prompt is at lines 109-131 (extractColorsPrompt, for uploaded logos)
 * 4. Brand colors MUST always return exactly 5 hex codes in order: primary, secondary, accent, background, text
 * 5. Error handling falls back to extractColorsPrompt if JSON parsing fails
 * 6. Test with both logo generation and color extraction modes
 * 7. ✅ Phase 3 COMPLETE: Now reads logo style and color scheme from business type config
 *
 * @phase3Changes
 * - ✅ Imports business type config helper function (getBusinessTypeById)
 * - ✅ Flow reads logoStyle from config (businessTypeConfig.journey.onboarding.logoStyle)
 * - ✅ Flow reads colorScheme from config (businessTypeConfig.journey.onboarding.colorScheme)
 * - ✅ Enhanced logo generation prompt includes style and color scheme guidance
 * - ✅ Fallback to generic style if business type not found
 * - Examples:
 *   - Fashion: "elegant, minimalist, fashion-forward" + "sophisticated, trendy, timeless"
 *   - Electronics: "modern, sleek, tech-forward" + "blue/gray professional tones, high-tech aesthetic"
 *   - Handmade: "handcrafted, artistic, personal" + "warm, authentic, creative"
 *
 * @see /src/app/onboarding/onboarding-form.tsx:172 - Logo generation caller
 * @see /src/app/onboarding/onboarding-form.tsx:340 - Color extraction caller
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
});
export type GuideBusinessOnboardingInput = z.infer<typeof GuideBusinessOnboardingInputSchema>;

const GuideBusinessOnboardingOutputSchema = z.object({
  logoDataUri: z
    .string()
    .optional()
    .describe(
      'The data URI of the generated logo, including MIME type and Base64 encoding, if a logo was generated.'
    ),
  brandColors: z.array(z.string()).describe('A list of 5 brand colors in hex format (e.g., #RRGGBB) extracted from the logo or generated.'),
});
export type GuideBusinessOnboardingOutput = z.infer<typeof GuideBusinessOnboardingOutputSchema>;

/**
 * Main onboarding flow function - generates logo or extracts colors
 *
 * @param input - Business onboarding input data
 * @param input.businessName - Merchant's business name (e.g., "Amara Fashion")
 * @param input.businessType - Business category (e.g., "fashion", "electronics", "handmade")
 * @param input.brandPreferences - User's favorite color for logo generation (e.g., "deep ocean blue")
 * @param input.logoDataUri - Optional uploaded logo as data URI. If provided, extracts colors instead of generating logo.
 *
 * @returns Promise<GuideBusinessOnboardingOutput>
 * @returns output.logoDataUri - Generated logo as data URI (undefined if extracting from uploaded logo)
 * @returns output.brandColors - Array of exactly 5 hex color codes: [primary, secondary, accent, background, text]
 *
 * @throws {Error} When AI fails to generate logo or extract colors
 * @throws {Error} When response doesn't match output schema
 *
 * @example
 * // Generate new logo
 * const result = await guideBusinessOnboarding({
 *   businessName: 'Amara Fashion',
 *   businessType: 'fashion',
 *   brandPreferences: 'deep ocean blue',
 * });
 * console.log(result.brandColors); // ['#3F51B5', '#9C27B0', '#FFC107', '#F5F5F5', '#212121']
 *
 * @example
 * // Extract colors from uploaded logo
 * const result = await guideBusinessOnboarding({
 *   businessName: 'Amara Fashion',
 *   businessType: 'fashion',
 *   brandPreferences: '',
 *   logoDataUri: 'data:image/png;base64,...',
 * });
 * console.log(result.brandColors); // ['#...', '#...', '#...', '#...', '#...']
 *
 * @aiContext
 * - Mode determined by presence of logoDataUri: undefined = generate, string = extract
 * - ✅ Business type automatically influences logo style via config:
 *   - Flow reads from /src/config/business-types.ts
 *   - Logo style: businessTypeConfig.journey.onboarding.logoStyle
 *   - Color scheme: businessTypeConfig.journey.onboarding.colorScheme
 * - Brand preferences should be color descriptors (e.g., "warm sunset orange", not just "orange")
 * - Returns exactly 5 colors, no more, no less
 */
export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
  return guideBusinessOnboardingFlow(input);
}

const extractColorsPrompt = ai.definePrompt({
  name: 'extractColorsPrompt',
  input: {schema: GuideBusinessOnboardingInputSchema},
  output: {schema: z.object({ brandColors: z.array(z.string()) })},
  prompt: `You are an expert branding assistant.
Your task is to analyze the provided logo and extract a 5-color palette from it.
The palette should consist of:
1. A primary color.
2. A secondary color.
3. An accent color.
4. A neutral background color.
5. A dark text color.

Business Name: {{{businessName}}}
Business Type: {{{businessType}}}

Logo: {{media url=logoDataUri}}

Your final output must be ONLY a JSON object with a "brandColors" key containing an array of exactly 5 hex color codes.
`,
});

const guideBusinessOnboardingFlow = ai.defineFlow(
  {
    name: 'guideBusinessOnboardingFlow',
    inputSchema: GuideBusinessOnboardingInputSchema,
    outputSchema: GuideBusinessOnboardingOutputSchema,
  },
  async input => {
    // Get business type config for enhanced logo generation
    const businessTypeConfig = getBusinessTypeById(input.businessType);

    // Prepare style guidance from config
    const logoStyle = businessTypeConfig
      ? businessTypeConfig.journey.onboarding.logoStyle
      : 'simple, modern, and professional';

    const colorScheme = businessTypeConfig
      ? businessTypeConfig.journey.onboarding.colorScheme
      : 'harmonious and professional';

     if (input.logoDataUri) {
       const {output} = await extractColorsPrompt(input);
       if (!output) {
         throw new Error("Failed to get a structured response from the model when extracting colors.");
       }
       return { brandColors: output.brandColors };
    }

    const {media, output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            {
            text: `Generate a logo for a business named "${input.businessName}".
            The business is in the "${input.businessType}" sector.
            The user's favorite color is "${input.brandPreferences}", so the logo and brand colors should be inspired by this.

            LOGO STYLE GUIDANCE: ${logoStyle}
            COLOR SCHEME GUIDANCE: ${colorScheme}

            Create a logo that follows the style guidance above. After generating the logo, create a 5-color palette (primary, secondary, accent, background, text) based on the generated logo, following the color scheme guidance.
            Return ONLY the generated image and a JSON object with a "brandColors" key containing an array of 5 hex color strings.`,
            },
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    });

    if (!media || !output) {
      const error = new Error('AI failed to generate a logo or brand colors.');
      logger.error({ error, message: 'Logo and brand color generation failed.', flow: 'guideBusinessOnboardingFlow', input });
      throw error;
    }
    
    let parsedOutput: GuideBusinessOnboardingOutput;
    try {
        const jsonString = (output as string).replace(/```json|```/g, '').trim();
        const parsedJson = JSON.parse(jsonString);
        parsedOutput = GuideBusinessOnboardingOutputSchema.parse(parsedJson);
    } catch (error) {
        logger.error({ error, message: "Could not parse brand colors from model's text response.", flow: 'guideBusinessOnboardingFlow', output });
        const { output: structuredOutput } = await extractColorsPrompt(input);
        if(!structuredOutput || !structuredOutput.brandColors) {
            const extractionError = new Error("Could not extract brand colors from the model's response via structured output.");
            logger.error({ error: extractionError, message: "Secondary extraction attempt failed.", flow: 'guideBusinessOnboardingFlow', structuredOutput });
            throw extractionError;
        }
        parsedOutput = {
            logoDataUri: media.url,
            brandColors: structuredOutput.brandColors,
        };
    }
    
    return {
      logoDataUri: media.url,
      brandColors: parsedOutput.brandColors,
    };
  }
);
