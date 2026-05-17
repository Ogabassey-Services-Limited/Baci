import {
  AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
  AGENTIC_PAYMENT_PROVIDER_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_PROVIDER_PAYSTACK,
} from '@/config/agentic-payment-methods';
import {
  ucpCheckoutCompleteRequestSchema,
  ucpCheckoutCreateRequestSchema,
  ucpCheckoutUpdateRequestSchema,
} from '@/schemas/ucp-checkout-request';

type JsonRecord = Record<string, unknown>;

export function adaptUcpCheckoutCreateRequestBody(body: unknown): unknown {
  if (hasLegacyItems(body)) return body;

  const parsed = ucpCheckoutCreateRequestSchema.safeParse(body);
  if (!parsed.success) return body;

  const adapted: JsonRecord = {
    items: parsed.data.line_items.map(toAgenticCheckoutItem),
  };

  if (parsed.data.currency) adapted.currency = parsed.data.currency;
  if (isRecord(body) && Object.hasOwn(body, 'shipping_address')) {
    adapted.shipping_address = toAgenticShippingAddress(
      parsed.data.shipping_address
    );
  }

  return adapted;
}

export function adaptUcpCheckoutUpdateRequestBody(body: unknown): unknown {
  if (hasLegacyItems(body)) return body;

  const parsed = ucpCheckoutUpdateRequestSchema.safeParse(body);
  if (!parsed.success) return body;

  const adapted: JsonRecord = {
    fulfillment_option_id: resolveFulfillmentOptionId(body),
    items: parsed.data.line_items.map(toAgenticCheckoutItem),
    shipping_address:
      parsed.data.shipping_address === undefined
        ? null
        : toAgenticShippingAddress(parsed.data.shipping_address),
  };

  return adapted;
}

export function adaptUcpCheckoutCompleteRequestBody(body: unknown): unknown {
  if (hasLegacyCompleteBody(body)) return body;

  const parsed = ucpCheckoutCompleteRequestSchema.safeParse(body);
  if (!parsed.success) return body;

  const instrument =
    parsed.data.payment.instruments.find((item) => item.selected === true) ??
    parsed.data.payment.instruments[0];
  const billingAddress = toAgenticFulfillmentAddress(
    instrument.billing_address
  );
  const buyer = toAgenticBuyer({
    billingAddress,
    body,
    credential: instrument.credential,
    display: instrument.display,
    rawBillingAddress: instrument.billing_address,
  });
  if (!buyer) return body;

  const paymentData = toAgenticPaymentData({
    billingAddress,
    instrument,
  });
  if (!paymentData) return body;

  const adapted: JsonRecord = {
    buyer,
    payment_data: paymentData,
  };
  if (isRecord(body) && Object.hasOwn(body, 'completion_authorization')) {
    adapted.completion_authorization = body.completion_authorization;
  }

  return adapted;
}

function toAgenticCheckoutItem(lineItem: {
  item: { id: string };
  quantity: number;
}) {
  return {
    id: lineItem.item.id,
    quantity: lineItem.quantity,
  };
}

function toAgenticShippingAddress(
  value: Record<string, unknown> | null | undefined
) {
  if (value === null) return null;
  return toAgenticFulfillmentAddress(value) ?? null;
}

function toAgenticPaymentData({
  billingAddress,
  instrument,
}: {
  billingAddress: JsonRecord | undefined;
  instrument: {
    credential?: Record<string, unknown>;
    handler_id: string;
    type: string;
  };
}): JsonRecord | null {
  const provider = getPaymentProvider(instrument.handler_id, instrument.type);
  if (!provider) return null;

  const paymentData: JsonRecord = { provider };
  if (billingAddress) paymentData.billing_address = billingAddress;

  if (provider === AGENTIC_PAYMENT_PROVIDER_PAYSTACK) {
    const token =
      getStringField(instrument.credential, 'token') ??
      getStringField(instrument.credential, 'id') ??
      getStringField(instrument.credential, 'reference');
    if (!token) return null;
    paymentData.token = token;
  }

  return paymentData;
}

function getPaymentProvider(handlerId: string, type: string) {
  const normalizedHandlerId = handlerId.trim();
  const normalizedType = type.trim();

  if (
    normalizedHandlerId === AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY ||
    normalizedType === AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY
  ) {
    return AGENTIC_PAYMENT_PROVIDER_PAY_ON_DELIVERY;
  }

  if (
    normalizedHandlerId === AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER ||
    normalizedHandlerId === AGENTIC_PAYMENT_PROVIDER_PAYSTACK ||
    normalizedType === AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER ||
    normalizedType === AGENTIC_PAYMENT_PROVIDER_PAYSTACK
  ) {
    return AGENTIC_PAYMENT_PROVIDER_PAYSTACK;
  }

  return null;
}

function toAgenticBuyer({
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

function toAgenticFulfillmentAddress(
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

function hasLegacyItems(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.items);
}

function hasLegacyCompleteBody(value: unknown): boolean {
  return (
    isRecord(value) && isRecord(value.buyer) && isRecord(value.payment_data)
  );
}

function resolveFulfillmentOptionId(body: unknown): string | null {
  if (isRecord(body) && Object.hasOwn(body, 'fulfillment_option_id')) {
    const topLevelValue = getOwnFieldOrNull(body, 'fulfillment_option_id');
    if (typeof topLevelValue === 'string' && topLevelValue.trim().length > 0) {
      return topLevelValue.trim();
    }
    if (topLevelValue === null) {
      return null;
    }
  }

  const fulfillment = getRecordField(body, 'fulfillment');
  const methods = Array.isArray(fulfillment?.methods)
    ? fulfillment.methods
    : [];

  for (const method of methods) {
    if (!isRecord(method)) continue;
    const groups = Array.isArray(method.groups) ? method.groups : [];
    for (const group of groups) {
      if (!isRecord(group)) continue;
      const selectedOptionId = group.selected_option_id;
      if (typeof selectedOptionId === 'string' && selectedOptionId.trim()) {
        return selectedOptionId.trim();
      }
    }
  }

  return null;
}

function getOwnFieldOrNull(value: unknown, key: string) {
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : null;
}

function getRecordField(value: unknown, key: string) {
  const field = isRecord(value) ? value[key] : undefined;
  return isRecord(field) ? field : undefined;
}

function getStringField(value: unknown, key: string) {
  const field = isRecord(value) ? value[key] : undefined;
  return typeof field === 'string' && field.trim().length > 0
    ? field.trim()
    : undefined;
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
