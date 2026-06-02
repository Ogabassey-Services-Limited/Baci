import { redirect } from 'next/navigation';
import { getStorefrontShellSnapshotBase } from '@/app/(storefront)/[slug]/storefront-shell-snapshot';
import { asRoute } from '@/lib/routes';
import { isDomainIdentifier } from '@/lib/validation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const unstable_instant = false;

export default async function MyAccountRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  const shellSnapshotBase = await getStorefrontShellSnapshotBase(slug);
  const fallbackBasePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const basePath = shellSnapshotBase?.basePath ?? fallbackBasePath;

  redirect(asRoute(`${basePath}/account`));
}
