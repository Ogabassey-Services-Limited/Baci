import {
  createSitemapResponse,
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
    request.headers,
    slug
  );

  if (!sitemapContext) {
    return createSitemapResponse([]);
  }

  const entries = await getNamedSitemapEntries(sitemapContext, id);
  return createSitemapResponse(entries);
}
