import { headers } from 'next/headers';
import { isStorefrontHomePath } from '@/app/(storefront)/[slug]/storefront-home-path';
import { OgabasseyStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-static-resource-hints';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';

interface StorefrontHeroPreloadDecisionProps {
  enabled?: boolean;
  merchantSlug?: string | null;
  routeSlug: string;
  templateId?: string | null;
}

export async function StorefrontHeroPreloadDecision({
  enabled = true,
  merchantSlug,
  routeSlug,
  templateId,
}: StorefrontHeroPreloadDecisionProps) {
  if (!enabled || templateId !== OGABASSEY_TEMPLATE_ID) {
    return null;
  }

  const headersList = await headers();
  const pathname = headersList.get('x-pathname');
  if (!pathname?.trim()) {
    return null;
  }

  const shouldPreloadHeroImages = isStorefrontHomePath({
    merchantSlug,
    pathname,
    routeSlug,
  });

  return shouldPreloadHeroImages ? <OgabasseyStaticResourceHints /> : null;
}
