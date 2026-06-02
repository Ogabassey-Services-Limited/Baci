import { redirect } from 'next/navigation';
import { resolveLegacyAccountRedirectPath } from './legacy-account-redirect';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<PageSearchParams>;
}

export const unstable_instant = false;

export default async function MyAccountRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  const redirectPath = await resolveLegacyAccountRedirectPath({
    searchParams: resolvedSearchParams,
    slug,
  });

  redirect(redirectPath);
}
