import { z } from 'zod';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';

const boundedCopy = z.string().trim().min(1).max(MAX_AI_COPY_LENGTH);
const boundedLabel = z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH);

export const textPatchSchema = z
  .strictObject({
    align: z.enum(['left', 'center', 'right']).optional(),
    componentType: z.literal('Text'),
    content: boundedCopy.optional(),
    title: boundedLabel.optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable text field'
  );
