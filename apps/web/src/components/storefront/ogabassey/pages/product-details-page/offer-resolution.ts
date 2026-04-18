import { getEffectiveStock } from '@/lib/product-stock';
import type { ResolvedProductVariantSelection } from '@baci/shared/lib';
import type { ConditionType } from './product-condition';
import type { NormalizedProductDetails } from './product-normalization';

export interface ProductDetailsCurrentOffer {
  id: NormalizedProductDetails['id'];
  price: string;
  rawPrice: number;
  stock: number;
}

const NGN_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function formatNgnCurrency(value: number): string {
  return NGN_FORMATTER.format(value);
}

export function resolveCurrentOffer(
  productData: NormalizedProductDetails,
  selectedCondition: ConditionType,
  selectedAttributes: Record<string, string>,
  variantSelection?: ResolvedProductVariantSelection<{
    id: string;
    price_override?: number | null;
    price_modifier?: number | null;
    stock_quantity?: number | null;
  }> | null
): ProductDetailsCurrentOffer {
  let price = productData.rawPrice || 0;
  if (!price && typeof productData.price === 'string') {
    price =
      Number.parseInt(productData.price.replace(/[^0-9]/g, ''), 10) || 0;
  }

  let stock = productData.manage_stock ? getEffectiveStock(productData) : 999;

  if (
    selectedCondition.toLowerCase() !==
    (productData.condition || 'new').toLowerCase()
  ) {
    const offer = productData.offers?.find(
      (item) => item.condition.toLowerCase() === selectedCondition.toLowerCase()
    );

    if (offer) {
      price = offer.rawPrice;
      stock = getEffectiveStock(offer);
    }
  }

  if (variantSelection?.variant) {
    price = variantSelection.price;
    stock = getEffectiveStock(variantSelection.variant);
    return {
      price: formatNgnCurrency(price),
      rawPrice: price,
      stock,
      id: productData.id,
    };
  }

  const selectedAttributeKeys = Object.keys(selectedAttributes);
  if (selectedAttributeKeys.length > 0 && productData.variants) {
    const variant = productData.variants.find((item) => {
      const attributes = item.attributes || {};
      return selectedAttributeKeys.every((key) => {
        const legacyValue = (item as unknown as Record<string, unknown>)[key];
        return (
          attributes[key] === selectedAttributes[key] ||
          legacyValue === selectedAttributes[key]
        );
      });
    });

    if (variant) {
      if (variant.price_override) {
        price = variant.price_override;
      } else if (variant.price_modifier) {
        price += variant.price_modifier;
        price = Math.max(0, price);
      }

      stock = getEffectiveStock(variant);
    }
  }

  return {
    price: formatNgnCurrency(price),
    rawPrice: price,
    stock,
    id: productData.id,
  };
}
