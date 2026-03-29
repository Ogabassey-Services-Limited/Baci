import type { headers } from 'next/headers';
import { getRootDomain } from '@/env';

export function resolveRouteIdentifier(
  headersList: Awaited<ReturnType<typeof headers>>
) {
  const customDomain = headersList.get('x-custom-domain')?.toLowerCase();
  if (customDomain) {
    return customDomain;
  }

  const merchantSlug = headersList.get('x-merchant-slug')?.toLowerCase();
  if (merchantSlug) {
    return merchantSlug;
  }

  const host = headersList.get('host')?.split(':')[0].toLowerCase();
  if (!host) {
    return '';
  }

  const normalizedHost = host.replace(/^www\./, '');
  const rootDomain = (getRootDomain() || 'usebaci.com').toLowerCase();
  const developmentHosts = new Set(['127.0.0.1', 'localhost']);

  if (developmentHosts.has(normalizedHost)) {
    return '';
  }

  if (normalizedHost === rootDomain) {
    return '';
  }

  if (normalizedHost.endsWith(`.${rootDomain}`)) {
    return normalizedHost.slice(0, -(rootDomain.length + 1));
  }

  return normalizedHost;
}
