import { z } from 'zod';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';
import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';

const richText = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (value) => !hasUnstableBlogContentMedia(value),
      'Structured rich text links and media must be release-safe'
    );
const requiredRichText = (max: number) => richText(max).min(1);

const PublicMediaUrlSchema = z
  .string()
  .max(2_048)
  .refine(isStablePublicMediaUrl, 'Expected immutable public media');
const PublicUrlSchema = z
  .string()
  .max(2_048)
  .refine(isSafePublicReleaseUrl, 'Expected a query-free public URL');
const PersonSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(160).optional(),
  bio: richText(10_000).optional(),
  imageUrl: PublicMediaUrlSchema.optional(),
});

const AboutContentSchema = z.strictObject({
  kind: z.literal('about'),
  story: richText(30_000).optional(),
  mission: richText(10_000).optional(),
  vision: richText(10_000).optional(),
  values: z.array(z.string().trim().min(1).max(1_000)).max(32).optional(),
  founder: PersonSchema.optional(),
  team: z.array(PersonSchema).max(100).optional(),
  milestones: z
    .array(
      z.strictObject({
        year: z.number().int().min(1_000).max(9_999),
        title: z.string().trim().min(1).max(240),
        description: richText(5_000).optional(),
      })
    )
    .max(100)
    .optional(),
  awards: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(240),
        issuer: z.string().trim().min(1).max(240).optional(),
        year: z.number().int().min(1_000).max(9_999).optional(),
      })
    )
    .max(100)
    .optional(),
  galleryUrls: z.array(PublicMediaUrlSchema).max(64).optional(),
  videoUrl: PublicUrlSchema.optional(),
});

const FaqContentSchema = z.strictObject({
  kind: z.literal('faq'),
  items: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1).max(160).optional(),
        question: z.string().trim().min(1).max(1_000),
        answer: requiredRichText(10_000),
        category: z.string().trim().min(1).max(160).optional(),
      })
    )
    .max(200),
});

/** Route-specific public structures required by About and FAQ renderers. */
export const StorefrontPublicContentPageStructuredSchema = z.discriminatedUnion(
  'kind',
  [AboutContentSchema, FaqContentSchema]
);
