import { z } from 'zod';

export const blogPostSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
    slug: z
        .string()
        .min(1, 'Slug is required')
        .max(200, 'Slug is too long')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
        .optional(),
    content: z.string().min(1, 'Content is required').optional(), // Content might be partial in some updates
    excerpt: z.string().max(300, 'Excerpt is too long').optional().nullable(),
    featured_image_url: z
        .string()
        .url('Must be a valid URL')
        .optional()
        .nullable()
        .or(z.literal('')), // Allow empty string to be sanitized later or handled
    featured_image_alt: z.string().max(200).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    tags: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    author_name: z.string().min(1).max(100).optional(),
    author_title: z.string().max(100).optional().nullable(),
    author_image_url: z.string().url().optional().nullable(),
    author_bio: z.string().max(500).optional().nullable(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    seo_title: z.string().max(70).optional().nullable(),
    seo_description: z.string().max(160).optional().nullable(),
    focus_keyword: z.string().max(50).optional().nullable(),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;

// Sanitizer function to clean data before sending to API/Zod
export function sanitizeBlogPostData(data: Partial<BlogPostInput>) {
    const sanitized = { ...data };

    // Convert empty strings to null or undefined based on what the API expects
    if (sanitized.featured_image_url === '') sanitized.featured_image_url = null;
    if (sanitized.slug === '') sanitized.slug = undefined;

    return sanitized;
}
