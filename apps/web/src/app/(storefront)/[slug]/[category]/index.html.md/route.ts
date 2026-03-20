import {
  getCachedCategoryPageData,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import {
  buildCategoryMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; category: string }> }
) {
  const { slug, category } = await context.params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const data = await getCachedCategoryPageData(merchant.id, category, slug);
  if (!data || !Array.isArray(data.products) || data.products.length === 0) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildCategoryMarkdown(
      merchant,
      `${url.protocol}//${url.host}`,
      category,
      data
    )
  );
}
