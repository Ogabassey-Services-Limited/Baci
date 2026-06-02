import { redirect } from 'next/navigation';
import { resolveLegacyAccountRedirectPath } from '../legacy-account-redirect';

interface PageProps {
  params: Promise<{ slug: string; path: string[] }>;
}

export const unstable_instant = false;

export default async function MyAccountCatchAllRedirectPage({
  params,
}: PageProps) {
  const { slug, path } = await params;
  const redirectPath = await resolveLegacyAccountRedirectPath({
    slug,
    segments: path,
  });

  redirect(redirectPath);
}
