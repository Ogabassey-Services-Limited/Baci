import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { resolveLegacyAccountRedirectPath } from '../legacy-account-redirect';

export const metadata: Metadata = {
  title: 'Account Redirect',
  description: 'Redirects legacy account URLs to the customer account area.',
};

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
