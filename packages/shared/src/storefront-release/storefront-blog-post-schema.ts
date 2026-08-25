import { z } from 'zod';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';

const SlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => slug !== 'author' && slug !== 'category', {
    message: 'Blog slug is reserved by a static blog route',
  });
const OptionalMediaUrlSchema = z
  .string()
  .refine(isStablePublicMediaUrl, 'Expected a stable public media URL')
  .nullable()
  .optional();

/** Bounded public fields required by storefront blog listing and post routes. */
export const StorefrontBlogPostSchema = z
  .strictObject({
    id: z.uuid(),
    slug: SlugSchema,
    title: z.string().trim().min(1).max(240),
    content: z.string().min(1).max(500_000),
    excerpt: z.string().max(2_000).nullable().optional(),
    featuredImageUrl: OptionalMediaUrlSchema,
    featuredImageAlt: z.string().max(500).nullable().optional(),
    authorName: z.string().trim().min(1).max(160),
    authorTitle: z.string().max(160).nullable().optional(),
    authorImageUrl: OptionalMediaUrlSchema,
    authorBio: z.string().max(2_000).nullable().optional(),
    category: z.string().max(160).nullable().optional(),
    status: z.literal('published'),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    keywords: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
    publishedAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    seoTitle: z.string().max(240).nullable().optional(),
    seoDescription: z.string().max(500).nullable().optional(),
    readingTimeMinutes: z.number().int().nonnegative().max(10_000).optional(),
  })
  .superRefine((post, context) => {
    if (hasUnstableBlogContentMedia(post.content))
      context.addIssue({
        code: 'custom',
        message: 'Blog content media must use release asset paths',
        path: ['content'],
      });
  });
