import z from 'zod';
import { builderConfigSchema } from '@/schemas/builder';

// Colour dictionary the storefront theme understands. Kept as an explicit,
// passthrough shape so the copilot can send known keys (primary/accent/
// header/footer) with editor-friendly validation while still tolerating any
// additional theme colours a merchant's template defines.
const PuckThemeColorsSchema = z
  .object({
    primary: z.string().optional(),
    accent: z.string().optional(),
    header: z
      .object({
        background: z.string().optional(),
        text: z.string().optional(),
        iconColor: z.string().optional(),

        searchBorder: z.string().optional(),
        searchBackground: z.string().optional(),
      })
      .optional(),
    footer: z
      .object({
        background: z.string().optional(),
        text: z.string().optional(),
        linkColor: z.string().optional(),
        linkHoverColor: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

// The builder config is an OPEN shape (looseObject + arbitrary props/zones/
// theme dictionaries). This is the in-code "is this a renderable config" gate
// applied to the loose JSON the copilot providers return — see
// run-builder-provider-chain.ts for why no strict schema is sent to providers.
export const aiBuilderConfigSchema = builderConfigSchema
  .extend({
    theme: z
      .object({
        colors: PuckThemeColorsSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AiBuilderConfig = z.infer<typeof aiBuilderConfigSchema>;
