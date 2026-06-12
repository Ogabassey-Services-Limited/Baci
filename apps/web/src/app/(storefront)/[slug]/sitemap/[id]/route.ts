import { headers } from 'next/headers';
import {
  createSitemapIndexResponse,
  createSitemapResponse,
  createSitemapUnavailableResponse,
  getNamedSitemapEntries,
  getSitemapIndexLinks,
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

  if (id === 'root') {
    // Public /sitemap.xml rewrites here. Serve a sitemap index so each child
    // sitemap reports separately in Search Console and no URL is listed in
    // two submitted files.
    return createSitemapIndexResponse(
      await getSitemapIndexLinks(sitemapContext)
    );
  }

  const entries = await getNamedSitemapEntries(sitemapContext, id);
  return createSitemapResponse(entries);
}
