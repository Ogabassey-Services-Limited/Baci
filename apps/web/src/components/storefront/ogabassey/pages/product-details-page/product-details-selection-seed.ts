import type { ResolvedProductVariantSelection } from '@baci/shared/lib';
import type { Product } from '../../types';
import type { ConditionType } from './product-condition';
import type { normalizeProductDetails } from './product-normalization';

const VALID_CONDITIONS: ReadonlySet<ConditionType> = new Set<ConditionType>([
  'new',
  'used',
  'open_box',
]);

type ProductVariantSelection =
  | ResolvedProductVariantSelection<NonNullable<Product['variants']>[number]>
  | null;

export function isValidConditionParam(value: string): value is ConditionType {
  return VALID_CONDITIONS.has(value as ConditionType);
}

export function getValidAvailableConditions(
  values: Array<string | null | undefined>,
  normalizeCondition: (value: string | null | undefined) => string
) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeCondition(value))
        .filter(
          (value): value is ConditionType =>
            value !== '' && VALID_CONDITIONS.has(value as ConditionType)
        )
    )
  );
}

export function areSelectionAttributesEqual(
  left: Record<string, string>,
  right: Record<string, string>
) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value]) => right[key] === value);
}

export function getSelectionColor(selection: ProductVariantSelection) {
  return (
    selection?.color ||
    selection?.attributes?.color ||
    selection?.attributes?.Colour ||
    selection?.attributes?.colour ||
    undefined
  );
}

export function getSelectionImageIndex(
  productData: ReturnType<typeof normalizeProductDetails>,
  selection: ProductVariantSelection
) {
  const selectionColor = getSelectionColor(selection);
  const colorImage = selectionColor
    ? productData.colorImages[selectionColor]?.[0]
    : undefined;
  const variant = selection?.variant as
    | (NonNullable<Product['variants']>[number] & {
        primary_image?: string | null;
      })
    | undefined;
  const variantImage = variant?.primary_image || variant?.images?.find(Boolean);
  // Prefer the selected variant's own photo over the first image in its color
  // bucket. When several variants share a color but have different photos
  // (e.g. condition-specific used/open-box), the price-first default could
  // otherwise open the gallery on a different SKU's image and disagree with
  // the server preload, which uses the exact variant image.
  const image = variantImage || colorImage;

  if (!image) {
    return 0;
  }

  const imageIndex = productData.images.findIndex((item) => item === image);
  return imageIndex >= 0 ? imageIndex : 0;
}
