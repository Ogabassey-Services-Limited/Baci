import { headers } from 'next/headers';
import { getStorefrontPathPrefix } from '@/lib/storefront-path-prefix';
import {
  OgabasseyPdpSemanticSections,
  type OgabasseyPdpSemanticSectionsProps,
} from './ogabassey-pdp-semantic-sections';

type OgabasseyPdpRequestScopedSemanticSectionsProps = Omit<
  OgabasseyPdpSemanticSectionsProps,
  'productComparePathPrefix'
>;

export async function OgabasseyPdpRequestScopedSemanticSections(
  props: OgabasseyPdpRequestScopedSemanticSectionsProps
) {
  const productComparePathPrefix = getStorefrontPathPrefix(await headers(), {
    custom_domain: props.merchant.custom_domain,
    slug: props.storeSlug,
  });

  return (
    <OgabasseyPdpSemanticSections
      {...props}
      productComparePathPrefix={productComparePathPrefix}
    />
  );
}
