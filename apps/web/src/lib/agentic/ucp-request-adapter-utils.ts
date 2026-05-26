export type JsonRecord = Record<string, unknown>;

export function toAgenticShippingAddress(
  value: Record<string, unknown> | null | undefined
) {
  if (value === null) return null;
  return toAgenticFulfillmentAddress(value) ?? null;
}

export function toAgenticBuyer({
  billingAddress,
  body,
  credential,
  display,
  rawBillingAddress,
}: {
  billingAddress: JsonRecord | undefined;
  body: unknown;
  credential?: Record<string, unknown>;
  display?: Record<string, unknown>;
  rawBillingAddress?: Record<string, unknown>;
}): JsonRecord | null {
  const existingBuyer = getRecordField(body, 'buyer');
  const firstName =
    getStringField(existingBuyer, 'first_name') ??
    getStringField(rawBillingAddress, 'first_name') ??
    getStringField(billingAddress, 'first_name') ??
    getFirstNameFromFullName(getStringField(billingAddress, 'name'));
  const lastName =
    getStringField(existingBuyer, 'last_name') ??
    getStringField(rawBillingAddress, 'last_name') ??
    getStringField(billingAddress, 'last_name') ??
    getLastNameFromFullName(getStringField(billingAddress, 'name'));
  const phoneNumber =
    getStringField(existingBuyer, 'phone_number') ??
    getStringField(rawBillingAddress, 'phone_number') ??
    getStringField(billingAddress, 'phone') ??
    getStringField(credential, 'phone_number') ??
    getStringField(display, 'phone_number');
  const email =
    getStringField(existingBuyer, 'email') ??
    getStringField(rawBillingAddress, 'email') ??
    getStringField(billingAddress, 'email') ??
    getStringField(credential, 'email') ??
    getStringField(display, 'email');

  if (!email || !firstName || !lastName || !phoneNumber) return null;

  return {
    email,
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
  };
}

export function toAgenticFulfillmentAddress(
  value: Record<string, unknown> | undefined
): JsonRecord | undefined {
  if (!value) return undefined;

  const firstName = getStringField(value, 'first_name');
  const lastName = getStringField(value, 'last_name');
  const name =
    [firstName, lastName].filter(Boolean).join(' ') ||
    getStringField(value, 'name');
  const address = [
    getStringField(value, 'street_address') ?? getStringField(value, 'address'),
    getStringField(value, 'extended_address'),
  ]
    .filter(Boolean)
    .join(', ');
  const country =
    getStringField(value, 'address_country') ??
    getStringField(value, 'country');

  const normalized: JsonRecord = {};
  setOwnField(normalized, 'name', name || undefined);
  setOwnField(normalized, 'first_name', firstName);
  setOwnField(normalized, 'last_name', lastName);
  setOwnField(normalized, 'email', getStringField(value, 'email'));
  setOwnField(
    normalized,
    'phone',
    getStringField(value, 'phone_number') ?? getStringField(value, 'phone')
  );
  setOwnField(normalized, 'address', address || undefined);
  setOwnField(
    normalized,
    'city',
    getStringField(value, 'address_locality') ?? getStringField(value, 'city')
  );
  setOwnField(
    normalized,
    'state',
    getStringField(value, 'address_region') ?? getStringField(value, 'state')
  );
  setOwnField(normalized, 'country', country);
  if (country && /^[A-Za-z]{2,3}$/.test(country)) {
    normalized.country_code = country.toUpperCase();
  }
  setOwnField(normalized, 'postal_code', getStringField(value, 'postal_code'));

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function getOwnFieldOrNull(value: unknown, key: string) {
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : null;
}

export function getRecordField(value: unknown, key: string) {
  const field = isRecord(value) ? value[key] : undefined;
  return isRecord(field) ? field : undefined;
}

export function getStringField(value: unknown, key: string) {
  const field = isRecord(value) ? value[key] : undefined;
  return typeof field === 'string' && field.trim().length > 0
    ? field.trim()
    : undefined;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getFirstNameFromFullName(value: string | undefined) {
  if (!value) return undefined;
  return value.split(/\s+/)[0];
}

function getLastNameFromFullName(value: string | undefined) {
  if (!value) return undefined;
  const [, ...rest] = value.split(/\s+/);
  return rest.join(' ') || undefined;
}

function setOwnField(target: JsonRecord, key: string, value: unknown) {
  if (value !== undefined) target[key] = value;
}
