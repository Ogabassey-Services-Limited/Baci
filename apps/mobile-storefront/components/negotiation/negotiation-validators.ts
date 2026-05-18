const INVALID_OFFER_TITLE = 'Invalid Offer';
const INVALID_OFFER_MESSAGE = 'Please enter a valid price.';
const HIGHER_OFFER_MESSAGE =
  'Negotiated price must be lower than the current price.';

type InvalidOfferResult = {
  valid: false;
  message: string;
  title: typeof INVALID_OFFER_TITLE;
};

type ValidOfferResult = {
  amount: number;
  valid: true;
};

export type NegotiationOfferValidationResult =
  | InvalidOfferResult
  | ValidOfferResult;

interface ValidateNegotiationOfferArgs {
  currentPrice: number;
  offer: string;
}

export function validateNegotiationOffer({
  currentPrice,
  offer,
}: ValidateNegotiationOfferArgs): NegotiationOfferValidationResult {
  if (offer.includes('-')) {
    return {
      valid: false,
      title: INVALID_OFFER_TITLE,
      message: INVALID_OFFER_MESSAGE,
    };
  }

  const sanitizedOffer = offer.replace(/[^0-9.]/g, '');
  const decimalCount = (sanitizedOffer.match(/\./g) ?? []).length;

  if (!sanitizedOffer || decimalCount > 1) {
    return {
      valid: false,
      title: INVALID_OFFER_TITLE,
      message: INVALID_OFFER_MESSAGE,
    };
  }

  const offerAmount = Number.parseFloat(sanitizedOffer);

  if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
    return {
      valid: false,
      title: INVALID_OFFER_TITLE,
      message: INVALID_OFFER_MESSAGE,
    };
  }

  if (offerAmount >= currentPrice) {
    return {
      valid: false,
      title: INVALID_OFFER_TITLE,
      message: HIGHER_OFFER_MESSAGE,
    };
  }

  return {
    amount: offerAmount,
    valid: true,
  };
}
