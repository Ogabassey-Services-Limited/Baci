import type { Route } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildStorefrontLocalPath } from '@/lib/build-storefront-local-path';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyBlogPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const basePath = buildStorefrontLocalPath(await headers(), slug, '/blog');
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((val) => [k, val]) : v ? [[k, v]] : []
    )
  ).toString();
  const destination: Route = queryString
    ? (`${basePath}?${queryString}` as Route)
    : basePath;

  permanentRedirect(destination);
}
