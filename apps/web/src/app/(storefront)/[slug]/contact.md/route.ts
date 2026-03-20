import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  buildStorefrontContactMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const merchant = await getMerchantByIdentifier(slug);

  if (
    !merchant ||
    (!merchant.pages?.contact && !merchant.email && !merchant.phone)
  ) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildStorefrontContactMarkdown(merchant, `${url.protocol}//${url.host}`)
  );
}
