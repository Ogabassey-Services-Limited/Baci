import { getCachedBlogListing } from '@/lib/cached-data';
import {
  buildBlogIndexMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const data = await getCachedBlogListing(slug);

  if (!data || data.posts.length === 0) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildBlogIndexMarkdown(
      data.merchant,
      `${url.protocol}//${url.host}`,
      data.posts,
      data.categories
    )
  );
}
