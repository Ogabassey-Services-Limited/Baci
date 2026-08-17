import {
  normalizeNegotiationCustomerEmail,
  normalizePhoneToE164,
} from '@baci/shared/lib';

export class NegotiationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NegotiationValidationError';
  }
}

export function normalizeOptionalEmail(email?: string | null): string | null {
  return normalizeNegotiationCustomerEmail(email);
}

export function getContactValidationError({
  email,
  phone,
  isAuthenticated = false,
}: {
  email: string;
  phone: string;
  isAuthenticated?: boolean;
}): string | null {
  if (email.trim() && !normalizeOptionalEmail(email)) {
    return 'Enter a valid email address.';
  }

  if (phone.trim() && !normalizePhoneToE164(phone)) {
    return 'Enter a valid Phone / WhatsApp number.';
  }

  if (!isAuthenticated && !email.trim() && !phone.trim()) {
    return 'Provide an email address or Phone / WhatsApp number so we can send the merchant\'s decision.';
  }

  return null;
}
