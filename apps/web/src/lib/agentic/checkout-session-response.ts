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
    currency: currency.toLowerCase(),
    fulfillment_option_id: fulfillmentOptionId ?? null,
    fulfillment_options: fulfillmentOptions,
    id: sessionId,
    line_items: lineItems,
    links: [
      { type: 'terms_of_use', url: policyUrls.terms_of_service_url },
      { type: 'privacy_policy', url: policyUrls.privacy_policy_url },
    ],
    messages,
    shipping_address: shippingAddress ?? null,
    status,
    totals,
  };
}
