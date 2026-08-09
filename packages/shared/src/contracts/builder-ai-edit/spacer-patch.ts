import { z } from 'zod';

export const spacerPatchSchema = z
  .strictObject({
    componentType: z.literal('Spacer'),
    height: z.enum(['small', 'medium', 'large', 'xlarge']).optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected a spacer height'
  );
