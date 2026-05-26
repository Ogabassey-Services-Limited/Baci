import {
  AGENTIC_PAYMENT_METHOD_GOOGLE_PAY,
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
import {
  getOwnFieldOrNull,
  getRecordField,
  getStringField,
  isRecord,
  type JsonRecord,
  toAgenticBuyer,
  toAgenticFulfillmentAddress,
  toAgenticShippingAddress,
} from './ucp-request-adapter-utils';

export function adaptUcpShippingAddressToAgentic(
  value: Record<string, unknown> | null | undefined
): JsonRecord | null {
  return toAgenticShippingAddress(value);
}

export function adaptUcpCheckoutCreateRequestBody(body: unknown): unknown {
  if (hasLegacyItems(body)) return body;
  if (isRecord(body) && typeof body.cart_id === 'string') {
    return {
      cart_id: body.cart_id,
      currency: typeof body.currency === 'string' ? body.currency : undefined,
    };
  }

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
    normalizedHandlerId === AGENTIC_PAYMENT_METHOD_GOOGLE_PAY ||
    normalizedType === AGENTIC_PAYMENT_METHOD_GOOGLE_PAY ||
    normalizedHandlerId === AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER ||
    normalizedHandlerId === AGENTIC_PAYMENT_PROVIDER_PAYSTACK ||
    normalizedType === AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER ||
    normalizedType === AGENTIC_PAYMENT_PROVIDER_PAYSTACK
  ) {
    return AGENTIC_PAYMENT_PROVIDER_PAYSTACK;
  }

  return null;
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
