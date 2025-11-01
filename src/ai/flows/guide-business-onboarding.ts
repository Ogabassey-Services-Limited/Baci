
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
  task: z.enum(['generate_logos', 'extract_colors']).describe("The specific task for the flow to perform."),
});
export type GuideBusinessOnboardingInput = z.infer<typeof GuideBusinessOnboardingInputSchema>;

const GuideBusinessOnboardingOutputSchema = z.object({
  logos: z
    .array(z.string())
    .optional()
    .describe(
      'An array of data URIs for the generated logos.'
    ),
  brandColors: z.array(z.string()).optional().describe('A list of 5 brand colors in hex format (e.g., #RRGGBB).'),
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

// Prompt for extracting colors from a user-uploaded or selected logo.
const extractColorsPrompt = ai.definePrompt({
  name: 'extractColorsPrompt',
  input: {schema: z.object({ logoDataUri: z.string() })},
  output: {schema: z.object({ brandColors: z.array(z.string()).length(5) })},
  prompt: `You are an expert branding assistant.
Your task is to analyze the provided logo and extract a 5-color palette from it.
The palette must consist of:
1. A primary color (the most dominant).
2. A secondary color (a complementary color).
3. An accent color (a vibrant color for buttons).
4. A neutral background color (light and clean).
5. A dark text color (for readability).

Logo: {{media url=logoDataUri}}

Your final output must be ONLY a valid JSON object with a "brandColors" key containing an array of exactly 5 hex color strings. Do not include any other text or markdown.
`,
});

// Define a schema for generating logos input, making logoDataUri optional
const GenerateLogosInputSchema = GuideBusinessOnboardingInputSchema.extend({
    logoDataUri: z.string().optional(),
});


// Prompt for generating multiple logo options.
const generateLogosPrompt = ai.definePrompt({
  name: 'generateLogosPrompt',
  input: { schema: GenerateLogosInputSchema },
  output: { schema: z.object({ logos: z.array(z.string()).length(4) }) },
  prompt: `Generate 4 unique, simple, modern, and professional logo options for a business named "{{businessName}}".
The business is in the "{{businessType}}" sector.
The user's favorite color is "{{brandPreferences}}", so the logos should be inspired by this.
The logos should be visually distinct from each other.
Return ONLY a valid JSON object with a "logos" key containing an array of 4 base64-encoded image strings.
`,
});

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
      const { output } = await extractColorsPrompt({ logoDataUri: input.logoDataUri });
      if (!output || !output.brandColors) {
        throw new Error("Failed to get a structured response from the model when extracting colors.");
      }
      return { brandColors: output.brandColors };
    }

    if (input.task === 'generate_logos') {
      logger.info({ message: 'Generating logo options.', flow: 'guideBusinessOnboardingFlow' });
      
      const businessTypeConfig = getBusinessTypeById(input.businessType);
      const logoStyle = businessTypeConfig?.journey.onboarding.logoStyle || 'simple, modern, and professional';

      const { media } = await ai.generate({
          model: 'googleai/gemini-2.5-flash-image-preview',
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

      if (!media || media.length < 4) {
        const error = new Error('AI failed to generate 4 logo options.');
        logger.error({ error, message: 'Logo generation failed to produce enough candidates.', flow: 'guideBusinessOnboardingFlow', input });
        throw error;
      }
      
      return {
        logos: media.map(m => m.url!),
      };
    }
    
    throw new Error('Invalid task provided to guideBusinessOnboardingFlow.');
  }
);
