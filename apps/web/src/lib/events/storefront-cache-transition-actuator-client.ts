import { createHash, createHmac } from 'node:crypto';
import { z } from 'zod';
import {
  type StorefrontCacheActuatorReceipt,
  type StorefrontCacheActuatorRequest,
  storefrontCacheActuatorReceiptSchema,
} from '@/schemas/storefront-cache-actuator';

const ACTUATOR_TIMEOUT_MS = 50_000;

export class StorefrontCacheTransitionActuatorFailure extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus?: number
  ) {
    super(code);
  }
}

const responseSchema = z.strictObject({
  ok: z.literal(true),
  receipt: storefrontCacheActuatorReceiptSchema,
});

export function getStorefrontCacheActuatorRequestBodySha256(
  rawBody: string
): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex');
}

function getStorefrontCacheActuatorSecret(): string | undefined {
  const secret = process.env.STOREFRONT_CACHE_ACTUATOR_SECRET?.trim();
  return secret || undefined;
}

function getActuatorUrl(): string {
  const configured = process.env.STOREFRONT_CACHE_ACTUATOR_URL?.trim();
  if (!configured) {
    throw new StorefrontCacheTransitionActuatorFailure(
      'actuator_configuration_invalid'
    );
  }
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:') {
      throw new StorefrontCacheTransitionActuatorFailure(
        'actuator_configuration_invalid'
      );
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof StorefrontCacheTransitionActuatorFailure) throw error;
    throw new StorefrontCacheTransitionActuatorFailure(
      'actuator_configuration_invalid'
    );
  }
}

export async function callStorefrontCacheActuator(
  request: StorefrontCacheActuatorRequest
): Promise<StorefrontCacheActuatorReceipt> {
  const secret = getStorefrontCacheActuatorSecret();
  if (!secret) {
    throw new StorefrontCacheTransitionActuatorFailure(
      'actuator_configuration_invalid'
    );
  }
  const rawBody = JSON.stringify(request);
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const requestBodySha256 =
    getStorefrontCacheActuatorRequestBodySha256(rawBody);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}\n${requestBodySha256}`, 'utf8')
    .digest('hex');
  const url = getActuatorUrl();
  let response: Response;
  try {
    response = await fetch(url, {
      body: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-baci-storefront-cache-signature': `v1=${signature}`,
        'x-baci-storefront-cache-timestamp': timestamp,
      },
      method: 'POST',
      signal: AbortSignal.timeout(ACTUATOR_TIMEOUT_MS),
    });
  } catch {
    throw new StorefrontCacheTransitionActuatorFailure(
      'actuator_request_failed'
    );
  }
  if (!response.ok) {
    throw new StorefrontCacheTransitionActuatorFailure(
      'actuator_rejected',
      response.status
    );
  }
  try {
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new StorefrontCacheTransitionActuatorFailure(
        'invalid_actuator_receipt',
        response.status
      );
    }
    return parsed.data.receipt;
  } catch (error) {
    if (error instanceof StorefrontCacheTransitionActuatorFailure) throw error;
    throw new StorefrontCacheTransitionActuatorFailure(
      'invalid_actuator_receipt',
      response.status
    );
  }
}
