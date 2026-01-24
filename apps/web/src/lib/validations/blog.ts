import { z } from 'zod';

export const blogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200, 'Slug is too long')
    .refine((val) => !val || /^[a-z0-9-]+$/.test(val), {
      message: 'Slug must contain only lowercase letters, numbers, and hyphens',
    })
    .optional(),
  content: z.string().min(1, 'Content is required').optional(), // Content might be partial in some updates
  excerpt: z.string().max(300, 'Excerpt is too long').optional().nullable(),
  featured_image_url: z
    .string()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Must be a valid URL' }
    )
    .optional()
    .nullable()
    .or(z.literal('')), // Allow empty string to be sanitized later or handled
  featured_image_alt: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  author_name: z.string().min(1, 'Author name is required').max(100).optional(),
  author_title: z.string().max(100).optional().nullable(),
  author_image_url: z
    .string()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Must be a valid URL' }
    )
    .optional()
    .nullable()
    .or(z.literal('')),
  author_bio: z.string().max(500).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived', 'scheduled']).optional(),
  published_at: z.string().datetime().optional().nullable(),
  seo_title: z
    .string()
    .max(70, 'SEO title must be 70 characters or less')
    .optional()
    .nullable(),
  seo_description: z
    .string()
    .max(160, 'Meta description must be 160 characters or less')
    .optional()
    .nullable(),
  focus_keyword: z
    .string()
    .max(50, 'Focus keyword must be 50 characters or less')
    .optional()
    .nullable(),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;

/**
 * Sanitizes blog post data for API consumption.
 * 2026 Best Practice: Centralized data cleaning before validation.
 */
export function sanitizeBlogPostData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Handle strings: convert empty to null (for DB) or undefined (for optional)
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        // Fields that should be null when empty
        const nullableFields = [
          'featured_image_url',
          'featured_image_alt',
          'excerpt',
          'category',
          'author_title',
          'author_bio',
          'author_image_url',
          'seo_title',
          'seo_description',
          'focus_keyword',
        ];
        sanitized[key] = nullableFields.includes(key) ? null : undefined;
      } else {
        sanitized[key] = trimmed;
      }
    }
    // Handle arrays (tags, keywords): remove empty/whitespace items
    else if (Array.isArray(value)) {
      sanitized[key] = value
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => item !== '');
    }
    // Passthrough other types
    else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
