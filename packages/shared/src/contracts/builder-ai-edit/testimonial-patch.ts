import { z } from 'zod';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';

const boundedCopy = z.string().trim().min(1).max(MAX_AI_COPY_LENGTH);
const boundedLabel = z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH);

export const testimonialPatchSchema = z
  .strictObject({
    author: boundedLabel.optional(),
    componentType: z.literal('Testimonial'),
    quote: boundedCopy.optional(),
    rating: z.number().int().min(0).max(5).optional(),
    role: boundedLabel.optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable testimonial field'
  );
