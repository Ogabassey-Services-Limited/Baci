import z from 'zod';
import { generateObjectWithChain } from '@/ai/generate-object-with-chain';
import type { AiContent } from './curated-storefront-types';

const aiContentSchema = z.object({
  hero: z
    .array(z.object({ title: z.string(), subtitle: z.string() }))
    .length(3),
  features: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string(),
      })
    )
    .length(3),
});

export async function generateLegacyAiCuratedContent(
  businessName: string,
  businessType: string
): Promise<AiContent | null> {
  try {
    const { object } = await generateObjectWithChain({
      schema: aiContentSchema,
      perProviderTimeoutMs: 10_000,
      prompt: `Generate 3 hero carousel slides (title, subtitle) and 3 unique features (title, description, icon name from lucide-react) for a "${businessType}" business named "${businessName}".
      The tone should be professional, engaging, and specific to the industry.
      For the icon, use only valid kebab-case Lucide icon names (e.g., 'shopping-bag', 'star', 'truck', 'shield-check').

      Return JSON in exactly this shape: {"hero": [{"title": string, "subtitle": string}], "features": [{"title": string, "description": string, "icon": string}]} — "hero" and "features" must each contain exactly 3 items.`,
    });
    return object;
  } catch (error) {
    console.error('AI Content Generation Failed:', error);
    return null;
  }
}
