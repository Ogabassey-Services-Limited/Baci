import { headers } from 'next/headers';
import {
  createSitemapResponse,
  createSitemapUnavailableResponse,
  getNamedSitemapEntries,
  resolveStorefrontSitemapContext,
} from '../../sitemap-data';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> }
): Promise<Response> {
  const { id: rawId, slug } = await context.params;
  const id = rawId.replace(/\.xml$/i, '');
  const sitemapContext = await resolveStorefrontSitemapContext(
    await headers(),
    slug,
    request
  );

  if (!sitemapContext) {
    return createSitemapUnavailableResponse();
  }

  const entries = await getNamedSitemapEntries(sitemapContext, id);
  return createSitemapResponse(entries);
}
