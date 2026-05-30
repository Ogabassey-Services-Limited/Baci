import { headers } from 'next/headers';
import {
  createSitemapResponse,
  getNamedSitemapEntries,
  getRootSitemapEntries,
  resolveStorefrontSitemapContext,
} from '../../sitemap-data';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> }
): Promise<Response> {
  const { id: rawId, slug } = await context.params;
  const id = rawId.replace(/\.xml$/i, '');
  const sitemapContext = await resolveStorefrontSitemapContext(
    await headers(),
    slug
  );

  if (!sitemapContext) {
    return createSitemapResponse([]);
  }

  if (id === 'root') {
    // Proxy routes public `/sitemap.xml` here because the Next metadata
    // `sitemap.ts` convention currently loses to `[category]` after storefront
    // custom-domain rewrites on Vercel.
    return createSitemapResponse(await getRootSitemapEntries(sitemapContext));
  }

  const entries = await getNamedSitemapEntries(sitemapContext, id);
  return createSitemapResponse(entries);
}
