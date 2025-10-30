'use server';

/**
 * @fileOverview Guides new users through the onboarding process to define their business type and brand preferences.
 *
 * - guideBusinessOnboarding - A function that handles the business onboarding process.
 * - GuideBusinessOnboardingInput - The input type for the guideBusinessOnboarding function.
 * - GuideBusinessOnboardingOutput - The return type for the guideBusinessOnboarding function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GuideBusinessOnboardingInputSchema = z.object({
  businessType: z.string().describe('The type of business the user is onboarding.'),
  brandPreferences: z.string().describe('The user\'s branding preferences.'),
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
  brandColors: z.array(z.string()).describe('A list of brand colors extracted from the logo or generated.'),
});
export type GuideBusinessOnboardingOutput = z.infer<typeof GuideBusinessOnboardingOutputSchema>;

export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
  return guideBusinessOnboardingFlow(input);
}

const extractColorsPrompt = ai.definePrompt({
  name: 'extractColorsPrompt',
  input: {schema: GuideBusinessOnboardingInputSchema},
  output: {schema: GuideBusinessOnboardingOutputSchema},
  prompt: `You are an expert branding assistant that helps extract colors from a logo or generate a logo if the user doesn't have one.

You will use the information provided to extract the brand colors from the logo, if provided, or generate a logo and extract colors if not.

Business Type: {{{businessType}}}
Brand Preferences: {{{brandPreferences}}}
{{#if logoDataUri}}
Logo: {{media url=logoDataUri}}
{{else}}
Generate a logo based on the business type and brand preferences.
{{/if}}

Output the logo as a data URI, if generated, and a list of brand colors.
Brand Colors:`,
});

const guideBusinessOnboardingFlow = ai.defineFlow(
  {
    name: 'guideBusinessOnboardingFlow',
    inputSchema: GuideBusinessOnboardingInputSchema,
    outputSchema: GuideBusinessOnboardingOutputSchema,
  },
  async input => {
    const {output} = await extractColorsPrompt(input);
    return output!;
  }
);
