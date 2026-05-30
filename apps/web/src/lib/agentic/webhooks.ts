import crypto from 'node:crypto';

const OPENAI_WEBHOOK_URL = process.env.OPENAI_AGENTIC_WEBHOOK_URL;
const MERCHANT_NAME_HEADER =
  process.env.OPENAI_AGENTIC_MERCHANT_HEADER_NAME || 'Merchant-Signature'; // e.g., 'Ogabassey-Signature'

const trimEnvSecret = (value: string | undefined) => value?.trim() ?? '';

const getMerchantSigningKey = () =>
  trimEnvSecret(process.env.BACI_AGENTIC_SIGNING_KEY) ||
  trimEnvSecret(process.env.OPENAI_AGENTIC_SIGNING_KEY);

export type AgenticWebhookEvent = 'order.created' | 'order.updated';

export interface AgenticOrderData {
  id: string;
  currency?: string;
  total?: number | string;
  status?: string;
  [key: string]: unknown;
}

interface WebhookPayload {
  event: AgenticWebhookEvent;
  order_id: string;
  payload: AgenticOrderData;
  timestamp: string;
}

export async function sendAgenticWebhook(
  event: AgenticWebhookEvent,
  orderData: AgenticOrderData
) {
  const merchantSigningKey = getMerchantSigningKey();
  if (!OPENAI_WEBHOOK_URL || !merchantSigningKey) {
    console.warn('Agentic webhook configuration missing. Skipping webhook.');
    return;
  }

  const payload: WebhookPayload = {
    event: event,
    order_id: orderData.id,
    payload: orderData,
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);

  // Create HMAC Signature
  const signature = crypto
    .createHmac('sha256', merchantSigningKey)
    .update(payloadString)
    .digest('hex');

  try {
    const response = await fetch(OPENAI_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [MERCHANT_NAME_HEADER]: signature,
        'X-Event-Type': event,
      },
      body: payloadString,
    });

    if (!response.ok) {
      console.error(
        `Failed to send webhook to OpenAI: ${response.status} ${response.statusText}`
      );
    }
  } catch (error: unknown) {
    console.error('Error sending agentic webhook:', error);
  }
}
