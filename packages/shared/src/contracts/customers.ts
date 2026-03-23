export const CUSTOMER_ADMIN_COLUMNS =
  'id, merchant_id, full_name, first_name, last_name, email, phone, address, store_credit, total_orders, total_spent, loyalty_points, created_at, updated_at, last_login_at, deleted_at';

export type CustomerNameFields = {
  email?: string | null;
  first_name?: string | null;
  full_name?: string | null;
  last_name?: string | null;
};

export function buildCustomerFullName(
  firstName?: string | null,
  lastName?: string | null,
  fallbackFullName?: string | null
): string | null {
  const fullName = [firstName, lastName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(' ');

  if (fullName.length > 0) {
    return fullName;
  }

  const trimmedFallback = fallbackFullName?.trim();
  return trimmedFallback ? trimmedFallback : null;
}

export function buildCustomerNameFields(input: CustomerNameFields) {
  const firstName = input.first_name?.trim() || null;
  const lastName = input.last_name?.trim() || null;
  const fullName =
    buildCustomerFullName(firstName, lastName, input.full_name) ||
    input.email?.split('@')[0]?.trim() ||
    null;

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
  };
}

export function splitCustomerFullName(
  fullName: string | null | undefined
): {
  first_name: string | null;
  last_name: string | null;
} {
  const trimmedName = fullName?.trim();
  if (!trimmedName) {
    return { first_name: null, last_name: null };
  }

  const [firstName, ...rest] = trimmedName.split(/\s+/);

  return {
    first_name: firstName || null,
    last_name: rest.length > 0 ? rest.join(' ') : null,
  };
}

export function getCustomerDisplayName(customer: CustomerNameFields): string {
  return (
    buildCustomerFullName(
      customer.first_name,
      customer.last_name,
      customer.full_name
    ) ||
    customer.email?.split('@')[0]?.trim() ||
    'Guest'
  );
}

function sanitizeCustomerSearchTerm(searchTerm: string): string {
  return searchTerm
    .normalize('NFKC')
    .trim()
    .replace(/[^\p{L}\p{N}\s@.-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

export function buildCustomerSearchFilter(searchTerm: string): string {
  const normalizedSearchTerm = sanitizeCustomerSearchTerm(searchTerm);

  return [
    `full_name.ilike.%${normalizedSearchTerm}%`,
    `first_name.ilike.%${normalizedSearchTerm}%`,
    `last_name.ilike.%${normalizedSearchTerm}%`,
    `email.ilike.%${normalizedSearchTerm}%`,
    `phone.ilike.%${normalizedSearchTerm}%`,
  ].join(',');
}

export function buildCustomerAddressLine(
  ...parts: Array<string | null | undefined>
): string | null {
  const address = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');

  return address.length > 0 ? address : null;
}
