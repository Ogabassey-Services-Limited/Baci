import type { Data } from '@puckeditor/core';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import type { GenerateInitialTemplateParams } from '@/lib/storefront-defaults/curated-storefront-types';
import { toCuratedStorefrontInput } from '@/lib/storefront-defaults/to-curated-storefront-input';

// biome-ignore lint/suspicious/useAwait: compatibility entry point remains awaitable
export async function generateInitialTemplate(
  params: GenerateInitialTemplateParams
): Promise<Data> {
  return buildCuratedStorefront(toCuratedStorefrontInput(params));
}
