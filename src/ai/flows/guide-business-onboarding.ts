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

export async function guideBusinessOnboarding(
  input: GuideBusinessOnboardingInput
): Promise<GuideBusinessOnboardingOutput> {
  return guideBusinessOnboardingFlow(input);
}

const extractColorsPrompt = ai.definePrompt({
  name: 'extractColorsPrompt',
  input: {schema: GuideBusinessOnboardingInputSchema},
  output: {schema: GuideBusinessOnboardingOutputSchema},
  prompt: `You are an expert branding assistant. Your task is to generate a simple, modern logo and a 5-color brand palette based on the user's input.

Business Name: {{{businessName}}}
Business Type: {{{businessType}}}
Favorite Color: {{{brandPreferences}}}

{{#if logoDataUri}}
An existing logo has been provided. Analyze the logo and extract a 5-color palette from it.
The palette should consist of:
1. A primary color.
2. A secondary color.
3. An accent color.
4. A neutral background color.
5. A dark text color.
Logo: {{media url=logoDataUri}}
{{else}}
The user does not have a logo. Generate a simple, modern, and professional logo for their business.
The logo design should be inspired by the business name, type, and the user's favorite color.
After generating the logo, create a 5-color palette based on the generated logo. The palette should be harmonious and suitable for a professional brand.
{{/if}}

Your final output must be a JSON object containing the generated logo's data URI (if one was created) and an array of exactly 5 hex color codes.
`,
});

const guideBusinessOnboardingFlow = ai.defineFlow(
  {
    name: 'guideBusinessOnboardingFlow',
    inputSchema: GuideBusinessOnboardingInputSchema,
    outputSchema: GuideBusinessOnboardingOutputSchema,
  },
  async input => {
     if (input.logoDataUri) {
       const {output} = await extractColorsPrompt(input);
       // If a logo is provided, we don't generate a new one, just extract colors.
       // The prompt is instructed to only return colors in this case.
       return { brandColors: output!.brandColors };
    }

    const {media, output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            {
            text: `Generate a simple, modern, and professional logo for a business named "${input.businessName}". 
            The business is in the "${input.businessType}" sector. 
            The user's favorite color is "${input.brandPreferences}", so the logo and brand colors should be inspired by this.
            After generating the logo, create a 5-color palette (primary, secondary, accent, background, text) based on the generated logo. The palette should be harmonious and suitable for a professional brand.
            Return ONLY the generated image and a JSON object with a "brandColors" key containing an array of 5 hex color strings.`,
            },
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    });

    if (!media || !output) {
      throw new Error('AI failed to generate a logo or brand colors.');
    }
    
    // Sometimes the model returns the JSON in the text part of the output, let's parse it
    let parsedOutput: GuideBusinessOnboardingOutput;
    try {
        const jsonString = (output as string).replace(/```json|```/g, '').trim();
        const parsedJson = JSON.parse(jsonString);
        parsedOutput = GuideBusinessOnboardingOutputSchema.parse(parsedJson);
    } catch (error) {
        // If parsing fails, we'll try to get it from the prompt's structured output.
        const { output: structuredOutput } = await extractColorsPrompt(input);
        if(!structuredOutput || !structuredOutput.brandColors) {
            throw new Error("Could not extract brand colors from the model's response.");
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
