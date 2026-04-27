import crypto from 'node:crypto';

const OPENAI_WEBHOOK_URL = process.env.OPENAI_AGENTIC_WEBHOOK_URL;
const MERCHANT_SIGNING_KEY = process.env.OPENAI_AGENTIC_SIGNING_KEY; // Provided by OpenAI
const MERCHANT_NAME_HEADER =
  process.env.OPENAI_AGENTIC_MERCHANT_HEADER_NAME || 'Merchant-Signature'; // e.g., 'Ogabassey-Signature'

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
  if (!OPENAI_WEBHOOK_URL || !MERCHANT_SIGNING_KEY) {
    console.warn('OpenAI Webhook configuration missing. Skipping webhook.');
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
    .createHmac('sha256', MERCHANT_SIGNING_KEY)
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
