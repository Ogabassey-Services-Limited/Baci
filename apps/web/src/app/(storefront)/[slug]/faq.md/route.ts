import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  buildStorefrontFaqMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';
import { parseLegacyFAQ } from '@/types/faq';

function hasFaqContent(
  merchant: Awaited<ReturnType<typeof getMerchantByIdentifier>>
) {
  if (!merchant) return false;
  if (Array.isArray(merchant.faq_items) && merchant.faq_items.length > 0) {
    return true;
  }
  if (merchant.pages?.faq) {
    return parseLegacyFAQ(merchant.pages.faq).length > 0;
  }
  return false;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant || !hasFaqContent(merchant)) {
    return notFoundMarkdownResponse('# Not Found\n');
  }

  const url = new URL(request.url);
  return markdownResponse(
    buildStorefrontFaqMarkdown(merchant, `${url.protocol}//${url.host}`)
  );
}
