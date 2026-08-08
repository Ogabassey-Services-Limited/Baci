import { z } from 'zod';
import { featuresPatchSchema } from './features-patch';
import { heroPatchSchema } from './hero-patch';
import { newsletterPatchSchema } from './newsletter-patch';
import { testimonialPatchSchema } from './testimonial-patch';
import { textPatchSchema } from './text-patch';

export const componentPatchSchema = z.discriminatedUnion('componentType', [
  heroPatchSchema,
  textPatchSchema,
  featuresPatchSchema,
  testimonialPatchSchema,
  newsletterPatchSchema,
]);

export type BuilderAiComponentPatch = z.infer<typeof componentPatchSchema>;
