import { getCachedBlogPost } from '@/lib/cached-data';
import { getLiveBlogPost } from '@/lib/live-blog-post';

type ResolvedBlogPost = Awaited<ReturnType<typeof getLiveBlogPost>>;

export async function getResolvedBlogPost(
  slug: string,
  postSlug: string,
  isDraftMode: boolean
): Promise<ResolvedBlogPost> {
  try {
    const cachedData = await getCachedBlogPost(slug, postSlug, isDraftMode);

    if (cachedData) {
      return cachedData;
    }
  } catch (error) {
    console.error(
      'Error fetching cached blog post, falling back to live query',
      {
        slug,
        postSlug,
        error,
      }
    );
  }

  return getLiveBlogPost(slug, postSlug, isDraftMode);
}
