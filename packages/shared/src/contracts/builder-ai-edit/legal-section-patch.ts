import { z } from 'zod';
import { MAX_AI_COPY_LENGTH, MAX_AI_LABEL_LENGTH } from './limits';

const sectionSchema = z.strictObject({
  content: z.string().trim().min(1).max(MAX_AI_COPY_LENGTH),
  heading: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH),
});

export const legalSectionPatchSchema = z
  .strictObject({
    componentType: z.literal('LegalSection'),
    lastUpdated: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH).optional(),
    sections: z.array(sectionSchema).min(1).max(12).optional(),
    title: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH).optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable legal section field'
  )
  .refine(
    (value) =>
      value.sections === undefined ||
      new Set(value.sections.map(({ heading }) => heading)).size ===
        value.sections.length,
    { message: 'Expected unique legal section headings', path: ['sections'] }
  );
