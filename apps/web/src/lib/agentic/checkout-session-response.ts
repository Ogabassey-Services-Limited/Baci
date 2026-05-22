import type {
  GPTFulfillmentOption,
  GPTLineItem,
  GPTMessage,
  GPTTotal,
} from '@/lib/agentic/checkout';
import type { AgentCheckoutStatus } from '@/lib/agentic/checkout-storage';
import { buildAgentPolicyUrls } from '@/lib/storefront-agent-urls';

export function buildCheckoutSessionStateResponse({
  currency,
  fulfillmentOptionId,
  fulfillmentOptions,
  lineItems,
  messages,
  policyBaseUrl,
  sessionId,
  shippingAddress,
  status,
  totals,
}: {
  currency: string;
  fulfillmentOptionId?: string | null;
  fulfillmentOptions: GPTFulfillmentOption[];
  lineItems: GPTLineItem[];
  messages: GPTMessage[];
  policyBaseUrl: string;
  sessionId: string;
  shippingAddress: unknown;
  status: AgentCheckoutStatus;
  totals: GPTTotal[];
}) {
  const policyUrls = buildAgentPolicyUrls(policyBaseUrl);

  return {
    capabilities: {},
    currency: currency.toLowerCase(),
    fulfillment_details: buildAcpFulfillmentDetails(shippingAddress),
    fulfillment_option_id: fulfillmentOptionId ?? null,
    fulfillment_options: fulfillmentOptions,
    id: sessionId,
    line_items: lineItems,
    links: [
      { type: 'terms_of_use', url: policyUrls.terms_of_service_url },
      { type: 'privacy_policy', url: policyUrls.privacy_policy_url },
    ],
    messages,
    selected_fulfillment_options: buildSelectedFulfillmentOptions({
      fulfillmentOptionId,
      fulfillmentOptions,
      lineItems,
    }),
    shipping_address: shippingAddress ?? null,
    status,
    totals,
  };
}

function buildSelectedFulfillmentOptions({
  fulfillmentOptionId,
  fulfillmentOptions,
  lineItems,
}: {
  fulfillmentOptionId?: string | null;
  fulfillmentOptions: GPTFulfillmentOption[];
  lineItems: GPTLineItem[];
}) {
  if (!fulfillmentOptionId) return [];

  const selectedOption = fulfillmentOptions.find(
    (option) => option.id === fulfillmentOptionId
  );

  return [
    {
      item_ids: lineItems.map((lineItem) => lineItem.id),
      option_id: fulfillmentOptionId,
      type: selectedOption?.type ?? 'shipping',
    },
  ];
}

function buildAcpFulfillmentDetails(shippingAddress: unknown) {
  if (!isRecord(shippingAddress)) return null;

  const name = getStringField(shippingAddress, 'name');
  const phone = getStringField(shippingAddress, 'phone');
  const email = getStringField(shippingAddress, 'email');
  const lineOne =
    getStringField(shippingAddress, 'address') ??
    getStringField(shippingAddress, 'line_one');
  const country =
    getStringField(shippingAddress, 'country_code') ??
    getStringField(shippingAddress, 'country');
  const city = getStringField(shippingAddress, 'city');
  const state = getStringField(shippingAddress, 'state');
  const postalCode = getStringField(shippingAddress, 'postal_code');
  const address = {
    ...(name ? { name } : {}),
    ...(lineOne ? { line_one: lineOne } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(country ? { country } : {}),
    ...(postalCode ? { postal_code: postalCode } : {}),
  };

  return {
    ...(name ? { name } : {}),
    ...(phone ? { phone_number: phone } : {}),
    ...(email ? { email } : {}),
    ...(Object.keys(address).length > 0 ? { address } : {}),
  };
}

function getStringField(value: Record<string, unknown>, field: string) {
  const raw = value[field];
  return typeof raw === 'string' && raw.trim().length > 0
    ? raw.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
