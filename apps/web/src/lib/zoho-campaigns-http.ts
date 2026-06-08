import { z } from 'zod';
import type { ZohoCampaignsOAuthConfig } from '@/env';
import {
  type FetchImplementation,
  ZohoCampaignsError,
} from '@/lib/zoho-campaigns-types';

export const zohoTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    api_domain: z.string().optional(),
    expires_in: z.coerce.number().optional(),
    refresh_token: z.string().optional(),
    token_type: z.string().optional(),
  })
  .passthrough();

export const zohoCreateCampaignResponseSchema = z
  .object({
    campaignKey: z.union([z.string(), z.number()]).transform(String).optional(),
  })
  .passthrough();

export const zohoSendCampaignResponseSchema = z
  .object({
    campaign_status: z.string().optional(),
    response: z
      .object({ campaign_status: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function toFormBody(values: Record<string, string>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readZohoCode(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const directCode = payload.code;
  if (typeof directCode === 'string' || typeof directCode === 'number') {
    return String(directCode);
  }

  const nestedResponse = payload.response;
  if (!isRecord(nestedResponse)) return null;
  const nestedCode = nestedResponse.code;
  return typeof nestedCode === 'string' || typeof nestedCode === 'number'
    ? String(nestedCode)
    : null;
}

export function describeZohoPayload(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const candidates = [
    payload.message,
    payload.error,
    payload.error_description,
    payload.details,
    isRecord(payload.response) ? payload.response.message : undefined,
    isRecord(payload.response) ? payload.response.error : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 300);
    }
  }

  const code = readZohoCode(payload);
  return code ? `Zoho response code ${code}` : null;
}

function assertZohoSuccess(payload: unknown) {
  const code = readZohoCode(payload);
  if (!code || code === '0' || code === '200') return;
  const details = describeZohoPayload(payload);
  throw new ZohoCampaignsError(
    details
      ? `Zoho Campaigns API returned an error: ${details}`
      : 'Zoho Campaigns API returned an error',
    { code }
  );
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ZohoCampaignsError('Zoho Campaigns returned non-JSON response', {
      statusCode: response.status,
    });
  }
}

export async function postZohoForm(
  url: string,
  body: URLSearchParams,
  accessToken: string,
  fetchImpl: FetchImplementation
): Promise<unknown> {
  const response = await fetchImpl(url, {
    body,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    const details = describeZohoPayload(payload);
    throw new ZohoCampaignsError(
      details
        ? `Zoho Campaigns request failed: ${details}`
        : 'Zoho Campaigns request failed',
      { statusCode: response.status }
    );
  }

  assertZohoSuccess(payload);
  return payload;
}

export function requireZohoOAuthFields(
  config: ZohoCampaignsOAuthConfig
): string[] {
  const missing: string[] = [];
  if (!config.clientId) missing.push('ZOHO_CAMPAIGNS_CLIENT_ID');
  if (!config.clientSecret) missing.push('ZOHO_CAMPAIGNS_CLIENT_SECRET');
  if (!config.redirectUri) missing.push('ZOHO_CAMPAIGNS_REDIRECT_URI');
  return missing;
}
