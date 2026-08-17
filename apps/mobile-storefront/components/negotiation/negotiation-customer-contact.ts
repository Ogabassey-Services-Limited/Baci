import { normalizePhoneToE164 } from '@baci/shared/lib';

export type NegotiationCustomerContact = {
  errorMessage: string | null;
  normalizedPhone: string | null;
  userId: string | null;
};

function getGuestNegotiationPhoneError(
  userId: string | null | undefined,
  normalizedPhone: string | null
): string | null {
  return !userId && !normalizedPhone
    ? 'Enter a Phone / WhatsApp number so the merchant can reach you about this offer.'
    : null;
}

export function buildNegotiationCustomerContact(
  userId: string | null | undefined,
  phone: string
): NegotiationCustomerContact {
  const normalizedPhone = normalizePhoneToE164(phone);
  const errorMessage = phone.trim()
    ? normalizedPhone
      ? null
      : 'Enter a valid Phone / WhatsApp number.'
    : getGuestNegotiationPhoneError(userId, normalizedPhone);

  return {
    errorMessage,
    normalizedPhone,
    userId: userId ?? null,
  };
}
