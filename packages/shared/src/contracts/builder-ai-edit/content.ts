import { z } from 'zod';
import { builderAiFeatureIconNames } from './feature-icons';
import { hasUniqueBuilderAiFeatureTitles } from './has-unique-builder-ai-feature-titles';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';
import { safeStorefrontUrlSchema } from './safe-storefront-url';

const boundedCopy = z.string().trim().min(1).max(MAX_AI_COPY_LENGTH);
const boundedLabel = z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH);
const alignment = z.enum(['left', 'center', 'right']);
const safeFeatureIcon = z.enum(builderAiFeatureIconNames);

function requiresEditableField<T extends { componentType: string }>(
  value: T
): boolean {
  return Object.keys(value).some((key) => key !== 'componentType');
}

export const heroPatchSchema = z
  .strictObject({
    align: alignment.optional(),
    componentType: z.literal('Hero'),
    ctaLink: safeStorefrontUrlSchema.optional(),
    ctaText: boundedLabel.optional(),
    overlay: z.boolean().optional(),
    padding: z.enum(['small', 'medium', 'large']).optional(),
    subtitle: boundedCopy.optional(),
    title: boundedLabel.optional(),
  })
  .refine(requiresEditableField, 'Expected at least one editable hero field');

export const textPatchSchema = z
  .strictObject({
    align: alignment.optional(),
    componentType: z.literal('Text'),
    content: boundedCopy.optional(),
    title: boundedLabel.optional(),
  })
  .refine(requiresEditableField, 'Expected at least one editable text field');

const featureSchema = z.strictObject({
  description: boundedCopy,
  icon: safeFeatureIcon.optional(),
  title: boundedLabel,
});

export const featuresPatchSchema = z
  .strictObject({
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    componentType: z.literal('Features'),
    features: z.array(featureSchema).min(1).max(8).optional(),
    subtitle: boundedCopy.optional(),
    title: boundedLabel.optional(),
  })
  .refine(
    requiresEditableField,
    'Expected at least one editable features field'
  )
  .refine(
    (value) =>
      value.features === undefined ||
      hasUniqueBuilderAiFeatureTitles(value.features),
    {
      message: 'Expected unique Feature titles',
      path: ['features'],
    }
  );

export const testimonialPatchSchema = z
  .strictObject({
    author: boundedLabel.optional(),
    componentType: z.literal('Testimonial'),
    quote: boundedCopy.optional(),
    rating: z.number().int().min(0).max(5).optional(),
    role: boundedLabel.optional(),
  })
  .refine(
    requiresEditableField,
    'Expected at least one editable testimonial field'
  );

export const newsletterPatchSchema = z
  .strictObject({
    buttonText: boundedLabel.optional(),
    componentType: z.literal('Newsletter'),
    description: boundedCopy.optional(),
    placeholder: boundedLabel.optional(),
    title: boundedLabel.optional(),
  })
  .refine(
    requiresEditableField,
    'Expected at least one editable newsletter field'
  );

export const heroCarouselSlidePatchFields = {
  ctaLink: safeStorefrontUrlSchema.optional(),
  ctaText: boundedLabel.optional(),
  subtitle: boundedCopy.optional(),
  title: boundedLabel.optional(),
};

export const heroCarouselSlidePatchSchema = z
  .strictObject(heroCarouselSlidePatchFields)
  .refine(
    (value) => Object.keys(value).length > 0,
    'Expected at least one editable carousel slide field'
  );

export const componentPatchSchema = z.discriminatedUnion('componentType', [
  heroPatchSchema,
  textPatchSchema,
  featuresPatchSchema,
  testimonialPatchSchema,
  newsletterPatchSchema,
]);

export type BuilderAiComponentPatch = z.infer<typeof componentPatchSchema>;
