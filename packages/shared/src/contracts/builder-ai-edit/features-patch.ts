import { z } from 'zod';
import { builderAiFeatureIconNames } from './feature-icons';
import { hasUniqueBuilderAiFeatureTitles } from './has-unique-builder-ai-feature-titles';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';

const boundedCopy = z.string().trim().min(1).max(MAX_AI_COPY_LENGTH);
const boundedLabel = z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH);
const featureSchema = z.strictObject({
  description: boundedCopy,
  icon: z.enum(builderAiFeatureIconNames).optional(),
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
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable features field'
  )
  .refine(
    (value) =>
      value.features === undefined ||
      hasUniqueBuilderAiFeatureTitles(value.features),
    { message: 'Expected unique Feature titles', path: ['features'] }
  );
