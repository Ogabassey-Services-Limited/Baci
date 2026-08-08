import {
  MAX_AI_COPY_LENGTH,
  MAX_AI_LABEL_LENGTH,
  MAX_AI_URL_LENGTH,
} from '@baci/shared/contracts';

const copyProps = new Set([
  'Features.subtitle',
  'Footer.copyrightText',
  'Hero.subtitle',
  'Newsletter.description',
  'Testimonial.quote',
  'Text.content',
]);
const labelProps = new Set([
  'Features.title',
  'Hero.ctaText',
  'Hero.title',
  'Newsletter.buttonText',
  'Newsletter.placeholder',
  'Newsletter.title',
  'ProductGrid.title',
  'Testimonial.author',
  'Testimonial.role',
  'Text.title',
]);
const urlProps = new Set(['Hero.ctaLink']);

export function getBuilderAiPropMaximumLength(
  componentType: string,
  property: string
): number | undefined {
  const key = `${componentType}.${property}`;
  if (copyProps.has(key)) return MAX_AI_COPY_LENGTH;
  if (labelProps.has(key)) return MAX_AI_LABEL_LENGTH;
  if (urlProps.has(key)) return MAX_AI_URL_LENGTH;
  return undefined;
}
