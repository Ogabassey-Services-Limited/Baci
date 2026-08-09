import { z } from 'zod';
import { buttonPatchSchema } from './button-patch';
import { faqPatchSchema } from './faq-patch';
import { featuresPatchSchema } from './features-patch';
import { heroPatchSchema } from './hero-patch';
import { legalSectionPatchSchema } from './legal-section-patch';
import { newsletterPatchSchema } from './newsletter-patch';
import { spacerPatchSchema } from './spacer-patch';
import { testimonialPatchSchema } from './testimonial-patch';
import { textPatchSchema } from './text-patch';

export const componentPatchSchema = z.discriminatedUnion('componentType', [
  heroPatchSchema,
  textPatchSchema,
  featuresPatchSchema,
  testimonialPatchSchema,
  newsletterPatchSchema,
  buttonPatchSchema,
  spacerPatchSchema,
  faqPatchSchema,
  legalSectionPatchSchema,
]);

export type BuilderAiComponentPatch = z.infer<typeof componentPatchSchema>;
