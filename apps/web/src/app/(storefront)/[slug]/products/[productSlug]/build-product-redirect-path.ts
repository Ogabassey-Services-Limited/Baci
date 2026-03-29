import { isDomainIdentifier } from '@/lib/validation';

interface HeaderLookup {
  has(name: string): boolean;
}

type HeadersProvider = () => HeaderLookup | Promise<HeaderLookup>;

export async function buildProductRedirectPath(
  storeSlug: string,
  productPath: string,
  getHeaders: HeadersProvider
): Promise<string> {
  const headersList = await getHeaders();
  const isPathMode =
    !headersList.has('x-merchant-slug') &&
    !headersList.has('x-custom-domain') &&
    !isDomainIdentifier(storeSlug);

  return isPathMode ? `/${storeSlug}${productPath}` : productPath;
}
