import { z } from 'zod';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';

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
  })
  .superRefine((page, context) => {
    if (
      page.format === 'sanitized_markdown' &&
      hasUnstableBlogContentMedia(page.body)
    )
      context.addIssue({
        code: 'custom',
        message: 'Content page links and media must be release-safe',
        path: ['body'],
      });
  });
