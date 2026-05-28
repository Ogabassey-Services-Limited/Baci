import { connection } from 'next/server';
import { resolveBlogCatchAllRoute } from './blog-catch-all-resolution';

/**
 * Catch-all route for legacy blog URLs with category prefixes.
 *
 * Handles URLs like:
 * - /blog/iphone/the-iphone-15-what-we-know-so-far
 * - /blog/smartphones/8-things-you-didnt-know-your-iphone-can-do
 * - /blog/gadgets/tecno-spark-10-pro-all-you-need-to-know
 *
 * Redirects to the canonical URL: /blog/{postSlug}
 *
 * Also filters out WordPress admin URLs (/blog/wp-admin/...) with 404.
 */
export default async function BlogCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string; catchAll: string[] }>;
}) {
  // Redirect-only legacy route: keep it request-time so it does not emit a PPR shell.
  await connection();
  await resolveBlogCatchAllRoute({ params });
  return null;
}
