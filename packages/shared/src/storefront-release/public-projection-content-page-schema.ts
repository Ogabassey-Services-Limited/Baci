import { z } from 'zod';
import { StorefrontPublicContentPageStructuredSchema } from './public-projection-content-page-structured-schema';
import { releaseSafeText } from './release-safe-text-schema';

const PUBLISHED_CONTENT_PAGE_SLUGS = new Set([
  'about',
  'contact',
  'faq',
  'privacy',
  'privacy-policy',
  'returns',
  'rewards',
  'shipping',
  'terms',
  'terms-and-conditions',
  'terms-of-service',
  'warranty',
]);
const ReleaseSafeContentBodySchema = releaseSafeText(500_000, 'Content page');

/** Published public content page with release-safe Markdown URLs. */
export const StorefrontPublicContentPageSchema = z
  .strictObject({
    id: z.uuid(),
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .refine((slug) => PUBLISHED_CONTENT_PAGE_SLUGS.has(slug), {
        message: 'Content page slug is not a published content route',
      }),
    title: z.string().trim().min(1).max(240),
    body: z.string().max(500_000),
    format: z.enum(['plain_text', 'sanitized_markdown']),
    status: z.literal('published'),
    publishedAt: z.iso.datetime({ offset: true }).optional(),
    structuredContent: StorefrontPublicContentPageStructuredSchema.optional(),
  })
  .superRefine((page, context) => {
    if (
      page.format === 'sanitized_markdown' &&
      !ReleaseSafeContentBodySchema.safeParse(page.body).success
    )
      context.addIssue({
        code: 'custom',
        message: 'Content page links and media must be release-safe',
        path: ['body'],
      });
    if (page.structuredContent && page.structuredContent.kind !== page.slug)
      context.addIssue({
        code: 'custom',
        message: 'Structured content must match its published page route',
        path: ['structuredContent', 'kind'],
      });
  });
