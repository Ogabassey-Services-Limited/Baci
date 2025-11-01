'use server';

/**
 * @fileOverview Guides new users through the onboarding process to define their business type and brand preferences.
 *
 * This flow provides two key capabilities:
 * 1. **Logo Generation:** Creates a professional logo and a matching 5-color palette based on business context and user color preferences.
 * 2. **Color Extraction:** Analyzes an existing uploaded logo and extracts a 5-color brand palette from it.
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
 * 2. Logo generation prompt is now part of the main flow logic (lines 149-166).
 * 3. Color extraction prompt is separate (`extractColorsPrompt`, lines 109-131).
 * 4. Brand colors MUST always return exactly 5 hex codes in order: primary, secondary, accent, background, text.
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
 * Main onboarding flow function - generates logo or extracts colors.
 *
 * @param input - Business onboarding input data
 * @param input.businessName - Merchant's business name (e.g., "Amara Fashion")
 * @param input.businessType - Business category (e.g., "fashion", "electronics")
 * @param input.brandPreferences - User's favorite color for logo generation (e.g., "deep ocean blue")
 * @param input.logoDataUri - Optional: If provided, extracts colors from the uploaded logo. If omitted, generates a new logo and colors.
 *
 * @returns Promise<GuideBusinessOnboardingOutput>
 * @returns output.logoDataUri - Generated logo as data URI (undefined if extracting from uploaded logo)
 * @returns output.brandColors - Array of exactly 5 hex color codes: [primary, secondary, accent, background, text]
 *
 * @throws {Error} When AI fails to generate or extract.
 *
 * @example
 * // To Generate a new logo and palette
 * const result = await guideBusinessOnboarding({
 *   businessName: 'Amara Fashion',
 *   businessType: 'fashion',
 *   brandPreferences: 'deep ocean blue',
 * });
 * console.log(result.logoDataUri); // 'data:image/png;base64,...'
 * console.log(result.brandColors); // ['#3F51B5', '#9C27B0', '#FFC107', '#F5F5F5', '#212121']
 *
 * @example
 * // To Extract colors from an uploaded logo
 * const result = await guideBusinessOnboarding({
 *   businessName: 'Amara Fashion',
 *   businessType: 'fashion',
 *   brandPreferences: '',
 *   logoDataUri: 'data:image/png;base64,...', // from file upload
 * });
 * console.log(result.logoDataUri); // undefined
 * console.log(result.brandColors); // ['#...', '#...', '#...', '#...', '#...']
 */
export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
  return guideBusinessOnboardingFlow(input);
}

// This prompt is ONLY for extracting colors from a user-uploaded logo.
const extractColorsPrompt = ai.definePrompt({
  name: 'extractColorsPrompt',
  input: {schema: GuideBusinessOnboardingInputSchema},
  output: {schema: z.object({ brandColors: z.array(z.string()) })},
  prompt: `You are an expert branding assistant.
Your task is to analyze the provided logo and extract a 5-color palette from it.
The palette must consist of:
1. A primary color (the most dominant).
2. A secondary color (a complementary color).
3. An accent color (a vibrant color for buttons).
4. A neutral background color (light and clean).
5. A dark text color (for readability).

Business Name: {{{businessName}}}
Business Type: {{{businessType}}}

Logo: {{media url=logoDataUri}}

Your final output must be ONLY a valid JSON object with a "brandColors" key containing an array of exactly 5 hex color strings. Do not include any other text or markdown.
`,
});

const guideBusinessOnboardingFlow = ai.defineFlow(
  {
    name: 'guideBusinessOnboardingFlow',
    inputSchema: GuideBusinessOnboardingInputSchema,
    outputSchema: GuideBusinessOnboardingOutputSchema,
  },
  async input => {
    // PATH 1: User uploaded a logo. Extract colors from it.
    if (input.logoDataUri) {
      logger.info({ message: 'Logo provided. Extracting colors.', flow: 'guideBusinessOnboardingFlow' });
      const {output} = await extractColorsPrompt(input);
      if (!output || !output.brandColors || output.brandColors.length !== 5) {
        throw new Error("Failed to get a structured response from the model when extracting colors.");
      }
      // No logo is generated, so logoDataUri is undefined.
      return { brandColors: output.brandColors };
    }

    // PATH 2: No logo uploaded. Generate a new logo and a color palette.
    logger.info({ message: 'No logo provided. Generating logo and colors.', flow: 'guideBusinessOnboardingFlow' });
    
    const businessTypeConfig = getBusinessTypeById(input.businessType);
    const logoStyle = businessTypeConfig?.journey.onboarding.logoStyle || 'simple, modern, and professional';
    const colorScheme = businessTypeConfig?.journey.onboarding.colorScheme || 'harmonious and professional';

    const {media, output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            {
            text: `Generate a logo for a business named "${input.businessName}".
The business is in the "${input.businessType}" sector.
The user's favorite color is "${input.brandPreferences}", so the logo and brand colors should be inspired by this.

LOGO STYLE GUIDANCE: ${logoStyle}
COLOR SCHEME GUIDANCE: ${colorScheme}

First, create a logo that follows the style guidance.
Second, simultaneously create a 5-color palette (primary, secondary, accent, background, text) that is based on and harmonious with the generated logo and color scheme guidance.

Your final output must contain two parts: the generated image, and a valid JSON object with a "brandColors" key containing an array of exactly 5 hex color strings. Do not include any other text or markdown formatting.`,
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
    
    let parsedOutput: { brandColors: string[] };
    try {
        const jsonString = (output as string).replace(/```json|```/g, '').trim();
        const parsedJson = JSON.parse(jsonString);
        // Ensure the parsed object has the correct shape.
        parsedOutput = z.object({ brandColors: z.array(z.string()).length(5, "The brandColors array must contain exactly 5 colors.") }).parse(parsedJson);
    } catch (error) {
        const extractionError = new Error("Could not parse a valid 5-color palette from the model's response.");
        logger.error({ error, message: "Parsing of generated brand colors failed.", flow: 'guideBusinessOnboardingFlow', badOutput: output });
        throw extractionError;
    }
    
    return {
      logoDataUri: media.url,
      brandColors: parsedOutput.brandColors,
    };
  }
);
