import {
  getCachedProductWithDetails,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import {
  buildProductMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';
import type { RawDbProduct } from '@/lib/normalize-product';

export async function GET(
  request: Request,
  context: {
    params: Promise<{ slug: string; category: string; productSlug: string }>;
  }
) {
  const { slug, productSlug } = await context.params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const product = await getCachedProductWithDetails(merchant.id, productSlug);
  if (!product) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildProductMarkdown(
      merchant,
      `${url.protocol}//${url.host}`,
      product as unknown as RawDbProduct
    )
  );
}
