import {
  buildNegotiationSingleItemInfo,
  COUNTER_NEGOTIATION_DISCOUNT_STEPS,
  type NegotiationCartLine,
  type summarizeCartForItemInfo,
} from '@baci/shared/lib';
import type { CartItem } from '@/stores/cart-store';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';
import type { NegotiationItemInfoViewModel } from './useNegotiationModalController.types';

type NegotiationRequestItemInfo =
  | ReturnType<typeof buildNegotiationSingleItemInfo>
  | ReturnType<typeof summarizeCartForItemInfo>;

/**
 * Build the `item_info` payload for a negotiation request: single offers keep
 * their per-product info; whole-cart ("total") offers use the summarized cart.
 */
export function buildNegotiationRequestItemInfo({
  itemInfo,
  totalItemInfo,
  type,
}: {
  itemInfo: NegotiationItemInfoViewModel | null;
  totalItemInfo: ReturnType<typeof summarizeCartForItemInfo> | null;
  type: 'single' | 'total';
}): NegotiationRequestItemInfo | null {
  if (type === 'single' && itemInfo) {
    return buildNegotiationSingleItemInfo({
      itemId: itemInfo.id,
      productName: itemInfo.name,
      productBrand: itemInfo.brand,
      currentPrice: itemInfo.currentPrice,
      productSlug: itemInfo.productSlug,
      variantId: itemInfo.variantId,
      variantName: itemInfo.variantName,
      variantAttributes: itemInfo.variantAttributes,
      condition: itemInfo.condition,
    });
  }

  return totalItemInfo;
}

/** Map a mobile cart line into the platform-neutral negotiation snapshot shape. */
export function toNegotiationCartLine(
  item: CartItem
): Partial<NegotiationCartLine> {
  const isQuizVoucher = Boolean(item.voucher_award_id && item.voucher_token);

  return {
    product_id: item.product_id,
    name: item.name,
    price: isQuizVoucher ? 0 : (item.negotiatedPrice ?? item.price),
    quantity: item.quantity,
    image: item.image_url,
    variant_id: item.variant_id,
    variant_name: item.variant_name,
    brand: item.brand,
    condition: item.condition,
  };
}

/** Counter-offer price + merchant reply for a given negotiation attempt. */
export interface NegotiationCounter {
  proposedCounter: number;
  replyMessage: string;
}

/**
 * Derive the counter-offer the merchant "bot" proposes for the current attempt.
 * The discount deepens with each attempt (capped by the configured steps) and
 * the copy escalates from playful to final.
 */
export function computeCounterOffer(
  attemptCount: number,
  currentPrice: number
): NegotiationCounter {
  const counterStepIndex = Math.min(
    attemptCount,
    COUNTER_NEGOTIATION_DISCOUNT_STEPS.length - 1
  );
  const counterDiscount = COUNTER_NEGOTIATION_DISCOUNT_STEPS[counterStepIndex];
  const replyMessage =
    counterStepIndex === 0
      ? "That's a bit low. But I can do:"
      : counterStepIndex === 1
        ? "We're getting closer. The best I can do is:"
        : 'This is my absolute final offer:';
  const proposedCounter = Math.floor(currentPrice * (1 - counterDiscount));
  return { proposedCounter, replyMessage };
}

/** Theme colors the success-state action button needs. */
interface SuccessButtonColors {
  primary: string;
  muted: string;
  primaryForeground: string;
  text: string;
}

/**
 * Button + label styles for the success-state action, switching between the
 * primary "apply" treatment and the neutral "done" treatment.
 */
export function buildSuccessButtonStyles(
  successActionStyle: 'primary' | 'neutral',
  colors: SuccessButtonColors
) {
  return successActionStyle === 'primary'
    ? {
        button: [styles.applyButton, { backgroundColor: colors.primary }],
        text: [styles.applyButtonText, { color: colors.primaryForeground }],
      }
    : {
        button: [styles.doneButton, { backgroundColor: colors.muted }],
        text: [styles.doneButtonText, { color: colors.text }],
      };
}
