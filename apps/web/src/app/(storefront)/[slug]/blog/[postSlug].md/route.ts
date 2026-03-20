import { getCachedBlogPost } from '@/lib/cached-data';
import {
  buildBlogPostMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; postSlug: string }> }
) {
  const { slug, postSlug } = await context.params;
  const data = await getCachedBlogPost(slug, postSlug);

  if (!data) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildBlogPostMarkdown(
      data.merchant,
      `${url.protocol}//${url.host}`,
      data.post
    )
  );
}
