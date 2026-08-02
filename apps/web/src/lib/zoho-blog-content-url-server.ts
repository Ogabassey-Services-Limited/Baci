import 'server-only';
import { trimTrailingSlash } from '@/lib/zoho-campaigns-http';
import { buildZohoBlogContentSignature } from './zoho-blog-content-signing-server';

export function buildZohoBlogContentUrl({
  contentSecret,
  postId,
  publicBaseUrl,
}: {
  contentSecret: string;
  postId: string;
  publicBaseUrl: string;
}): string {
  const url = new URL(
    `/api/integrations/zoho/blog-content/${encodeURIComponent(postId)}`,
    `${trimTrailingSlash(publicBaseUrl)}/`
  );
  url.searchParams.set(
    'sig',
    buildZohoBlogContentSignature({ contentSecret, postId })
  );
  return url.toString();
}
