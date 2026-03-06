import { headers } from 'next/headers';
import { isDomainIdentifier } from '@/lib/validation';

export interface RequestUrlContext {
  basePath: string;
  baseUrl: string;
  host: string;
  isLocalhost: boolean;
}

export async function getRequestUrlContext(
  slug: string
): Promise<RequestUrlContext> {
  const headersList = await headers();
  const host =
    headersList.get('host') ||
    (isDomainIdentifier(slug) ? slug : `${slug}.usebaci.com`);
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  return {
    basePath: isLocalhost ? `/${slug}` : '',
    baseUrl: `${protocol}://${host}`,
    host,
    isLocalhost,
  };
}
