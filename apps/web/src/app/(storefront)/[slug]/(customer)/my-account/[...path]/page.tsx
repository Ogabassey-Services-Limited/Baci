import { redirect } from 'next/navigation';
import { resolveLegacyAccountRedirectPath } from '../legacy-account-redirect';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  params: Promise<{ slug: string; path: string[] }>;
  searchParams?: Promise<PageSearchParams>;
}

export const unstable_instant = false;

export default async function MyAccountCatchAllRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug, path }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  const redirectPath = await resolveLegacyAccountRedirectPath({
    searchParams: resolvedSearchParams,
    slug,
    segments: path,
  });

  redirect(redirectPath);
}
