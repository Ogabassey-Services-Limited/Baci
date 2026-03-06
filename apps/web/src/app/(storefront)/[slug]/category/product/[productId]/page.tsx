import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { asRoute } from '@/lib/routes';
import { getRequestUrlContext } from '@/lib/url-context';
import { resolveLegacyProductTarget } from '../../../resolve-legacy-product-target';

interface PageProps {
  params: Promise<{
    slug: string;
    productId: string;
  }>;
}

export default async function LegacyCategoryProductPage({ params }: PageProps) {
  const { slug, productId } = await params;
  const { basePath } = await getRequestUrlContext(slug);
  const canonicalPath = await resolveLegacyProductTarget(slug, productId);

  if (canonicalPath) {
    permanentRedirect(asRoute(`${basePath}${canonicalPath}`));
  }

  notFound();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, productId } = await params;
  const { basePath, baseUrl } = await getRequestUrlContext(slug);
  const canonicalPath = await resolveLegacyProductTarget(slug, productId);

  return {
    title: canonicalPath ? 'Product Redirect' : 'Product Not Found',
    alternates: {
      canonical: canonicalPath
        ? `${baseUrl}${basePath}${canonicalPath}`
        : `${baseUrl}${basePath}/category/product/${encodeURIComponent(
            productId
          )}`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}
