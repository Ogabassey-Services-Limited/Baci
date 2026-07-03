const MAX_NEGOTIATION_CUSTOMER_EMAIL_LENGTH = 254;
const NEGOTIATION_CUSTOMER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeNegotiationCustomerEmail(
  email?: string | null
): string | null {
  const trimmedEmail = email?.trim().toLowerCase();
  if (
    !trimmedEmail ||
    trimmedEmail.length > MAX_NEGOTIATION_CUSTOMER_EMAIL_LENGTH
  ) {
    return null;
  }

  return NEGOTIATION_CUSTOMER_EMAIL_PATTERN.test(trimmedEmail)
    ? trimmedEmail
    : null;
}
