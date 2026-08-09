import { z } from 'zod';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';

const itemSchema = z.strictObject({
  answer: z.string().trim().min(1).max(MAX_AI_COPY_LENGTH),
  question: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH),
});

export const faqPatchSchema = z
  .strictObject({
    componentType: z.literal('FAQ'),
    items: z.array(itemSchema).min(1).max(12).optional(),
    style: z.enum(['accordion', 'grid', 'list']).optional(),
    subtitle: z.string().trim().min(1).max(MAX_AI_COPY_LENGTH).optional(),
    title: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH).optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable FAQ field'
  )
  .refine(
    (value) =>
      value.items === undefined ||
      new Set(value.items.map(({ question }) => question)).size ===
        value.items.length,
    { message: 'Expected unique FAQ questions', path: ['items'] }
  );
