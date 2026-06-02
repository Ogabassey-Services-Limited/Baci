import { redirect } from 'next/navigation';
import { resolveLegacyAccountRedirectPath } from './legacy-account-redirect';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const unstable_instant = false;

export default async function MyAccountRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  const redirectPath = await resolveLegacyAccountRedirectPath({ slug });

  redirect(redirectPath);
}
