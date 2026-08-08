import { z } from 'zod';
import { hasUniqueBuilderAiNavigationLabels } from './has-unique-builder-ai-navigation-labels';
import { MAX_AI_COPY_LENGTH } from './limits';
import { safeNavigationLinkSchema } from './safe-navigation-link';

export const footerPatchSchema = z
  .strictObject({
    componentType: z.literal('Footer'),
    copyrightText: z.string().trim().min(1).max(MAX_AI_COPY_LENGTH).optional(),
    quickLinks: z.array(safeNavigationLinkSchema).max(8).optional(),
    showNewsletter: z.boolean().optional(),
    showQuickLinks: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable footer field'
  )
  .refine(
    (value) =>
      value.quickLinks === undefined ||
      hasUniqueBuilderAiNavigationLabels(value.quickLinks),
    {
      message: 'Expected unique quick link labels',
      path: ['quickLinks'],
    }
  );
