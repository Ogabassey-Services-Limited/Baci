import { generateSlug } from '@/lib/blog-utils';
import { createPostSchema, sanitizeBlogPostData } from '@/lib/validations/blog';

export function prepareCreateBlogPostInput(rawBody: Record<string, unknown>) {
  const body = sanitizeBlogPostData(rawBody);
  if (!body.slug && body.title) body.slug = generateSlug(String(body.title));

  return {
    body,
    validation: createPostSchema.safeParse({
      ...body,
      author_name: body.author_name || 'Store Owner',
    }),
  };
}
