import { z } from 'zod';
import { MAX_AI_LABEL_LENGTH } from './limits';
import { safeStorefrontUrlSchema } from './safe-storefront-url';

export const buttonPatchSchema = z
  .strictObject({
    align: z.enum(['left', 'center', 'right']).optional(),
    componentType: z.literal('Button'),
    link: safeStorefrontUrlSchema.optional(),
    size: z.enum(['sm', 'default', 'lg']).optional(),
    text: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH).optional(),
    variant: z.enum(['primary', 'background', 'accent']).optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable button field'
  );
