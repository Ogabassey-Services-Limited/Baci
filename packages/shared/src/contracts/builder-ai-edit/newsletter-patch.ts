import { z } from 'zod';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';

const boundedCopy = z.string().trim().min(1).max(MAX_AI_COPY_LENGTH);
const boundedLabel = z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH);

export const newsletterPatchSchema = z
  .strictObject({
    buttonText: boundedLabel.optional(),
    componentType: z.literal('Newsletter'),
    description: boundedCopy.optional(),
    placeholder: boundedLabel.optional(),
    title: boundedLabel.optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable newsletter field'
  );
