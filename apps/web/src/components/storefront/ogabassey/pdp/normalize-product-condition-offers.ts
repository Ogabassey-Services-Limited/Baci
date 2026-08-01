import {
  normalizeProductCondition,
  type ProductConditionOffer,
} from '@/components/storefront/ogabassey/types';

type RawConditionOffer = {
  compare_at_price?: number | string | null;
  condition: string;
  condition_notes?: string;
  grade?: string;
  id: string;
  images?: string[];
  price: number | string;
  stock_quantity?: number;
};

function parseOfferPrice(value: number | string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function normalizeProductConditionOffers(
  offers: readonly RawConditionOffer[] | null | undefined,
  formatPrice: (value: number) => string
): ProductConditionOffer[] | undefined {
  if (offers == null) {
    return undefined;
  }

  return offers.flatMap((offer) => {
    const condition = normalizeProductCondition(offer.condition);
    if (!condition) {
      return [];
    }

    const rawPrice = parseOfferPrice(offer.price);
    const compareAtPrice =
      offer.compare_at_price == null
        ? undefined
        : formatPrice(parseOfferPrice(offer.compare_at_price));

    return [
      {
        compare_at_price: compareAtPrice,
        condition,
        grade: offer.grade,
        id: offer.id,
        images: offer.images,
        notes: offer.condition_notes,
        price: formatPrice(rawPrice),
        rawPrice,
        stock: offer.stock_quantity,
      },
    ];
  });
}
