import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  buildStorefrontHomeMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildStorefrontHomeMarkdown(merchant, `${url.protocol}//${url.host}`)
  );
}
