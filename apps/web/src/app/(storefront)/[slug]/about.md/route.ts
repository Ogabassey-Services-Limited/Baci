import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  buildStorefrontAboutMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant || (!merchant.about_page && !merchant.pages?.about)) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildStorefrontAboutMarkdown(merchant, `${url.protocol}//${url.host}`)
  );
}
