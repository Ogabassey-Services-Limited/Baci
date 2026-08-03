import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import type {
  CuratedStorefrontData,
  GenerateInitialTemplateParams,
} from '@/lib/storefront-defaults/curated-storefront-types';
import { toCuratedStorefrontInput } from '@/lib/storefront-defaults/to-curated-storefront-input';

// biome-ignore lint/suspicious/useAwait: compatibility entry point remains awaitable
export async function generateInitialTemplate(
  params: GenerateInitialTemplateParams
): Promise<CuratedStorefrontData> {
  return buildCuratedStorefront(toCuratedStorefrontInput(params));
}
