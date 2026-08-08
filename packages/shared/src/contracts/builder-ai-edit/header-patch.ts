import { z } from 'zod';
import { hasUniqueBuilderAiNavigationLabels } from './has-unique-builder-ai-navigation-labels';
import { MAX_AI_LABEL_LENGTH } from './limits';
import { safeNavigationLinkSchema } from './safe-navigation-link';
import { safeStorefrontUrlSchema } from './safe-storefront-url';

const safeCtaSchema = z.strictObject({
  show: z.boolean(),
  text: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH),
  url: safeStorefrontUrlSchema,
});

export const headerPatchSchema = z
  .strictObject({
    componentType: z.literal('Header'),
    ctaButton: safeCtaSchema.optional(),
    glassEffect: z.boolean().optional(),
    layout: z
      .enum(['logo-left-nav-center', 'logo-left-nav-right', 'logo-center'])
      .optional(),
    navigationLinks: z.array(safeNavigationLinkSchema).max(8).optional(),
    paddingY: z.enum(['sm', 'md', 'lg']).optional(),
    searchRadius: z.enum(['none', 'sm', 'md', 'full']).optional(),
    searchStyle: z.enum(['outline', 'filled', 'minimal']).optional(),
    showCart: z.boolean().optional(),
    showLogo: z.boolean().optional(),
    showMenu: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    sticky: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable header field'
  )
  .refine(
    (value) =>
      value.navigationLinks === undefined ||
      hasUniqueBuilderAiNavigationLabels(value.navigationLinks),
    {
      message: 'Expected unique navigation link labels',
      path: ['navigationLinks'],
    }
  );
