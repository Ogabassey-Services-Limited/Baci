import 'server-only';
import { normalizeEnvBoolean } from './env-boolean';

export type ZohoBlogCampaignRuntimeConfig = {
  accountsServerUrl: string;
  apiRootUrl: string;
  autoSend: boolean;
  clientId?: string;
  clientSecret?: string;
  contentSecret?: string;
  enabled: boolean;
  fromEmail?: string;
  fromName: string;
  listKey?: string;
  oauthState?: string;
  publicBaseUrl: string;
  redirectUri: string;
  refreshToken?: string;
  requestTimeoutMs: number;
  topicId?: string;
};

function readRuntimeValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function readRuntimeUrl(
  name: string,
  value: string | undefined,
  fallback: string
): string {
  const resolvedValue = readRuntimeValue(value) ?? fallback;
  try {
    new URL(resolvedValue);
    return resolvedValue;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function readRuntimeBoolean(value: string | undefined): boolean {
  return normalizeEnvBoolean(readRuntimeValue(value)) === true;
}

function readRuntimePositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const configuredValue = readRuntimeValue(value);
  if (!configuredValue) return fallback;
  const parsed = Number.parseInt(configuredValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPublicBaseUrl(): string {
  return readRuntimeUrl(
    'ZOHO_CAMPAIGNS_PUBLIC_BASE_URL',
    process.env.ZOHO_CAMPAIGNS_PUBLIC_BASE_URL,
    readRuntimeUrl(
      'NEXT_PUBLIC_APP_URL',
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3000'
    )
  );
}

function getZohoRedirectUri(publicBaseUrl: string): string {
  return readRuntimeUrl(
    'ZOHO_CAMPAIGNS_REDIRECT_URI',
    process.env.ZOHO_CAMPAIGNS_REDIRECT_URI,
    `${publicBaseUrl.replace(/\/$/, '')}/api/integrations/zoho/callback`
  );
}

function getZohoAccountsServerUrl(): string {
  return readRuntimeUrl(
    'ZOHO_CAMPAIGNS_ACCOUNTS_SERVER_URL',
    process.env.ZOHO_CAMPAIGNS_ACCOUNTS_SERVER_URL,
    'https://accounts.zoho.com'
  );
}

function getZohoApiRootUrl(): string {
  return readRuntimeUrl(
    'ZOHO_CAMPAIGNS_API_ROOT_URL',
    process.env.ZOHO_CAMPAIGNS_API_ROOT_URL,
    'https://campaigns.zoho.com/api/v1.1'
  );
}

function getZohoRequestTimeout(): number {
  return readRuntimePositiveInteger(
    process.env.ZOHO_CAMPAIGNS_REQUEST_TIMEOUT_MS,
    15_000
  );
}

function getZohoCampaignFromName(): string {
  return (
    readRuntimeValue(process.env.ZOHO_CAMPAIGNS_FROM_NAME) ?? 'Store Updates'
  );
}

function getZohoCampaignContentSecret(): string | undefined {
  return readRuntimeValue(process.env.ZOHO_CAMPAIGNS_CONTENT_SECRET);
}

function getZohoCampaignClientId(): string | undefined {
  return readRuntimeValue(process.env.ZOHO_CAMPAIGNS_CLIENT_ID);
}

function getZohoCampaignClientSecret(): string | undefined {
  return readRuntimeValue(process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET);
}

function getZohoCampaignOauthState(): string | undefined {
  return readRuntimeValue(process.env.ZOHO_CAMPAIGNS_OAUTH_STATE);
}

function getZohoCampaignTopicId(): string | undefined {
  return readRuntimeValue(process.env.ZOHO_CAMPAIGNS_TOPIC_ID);
}

function isZohoCampaignAutoSendEnabled(): boolean {
  return readRuntimeBoolean(process.env.ZOHO_CAMPAIGNS_AUTO_SEND);
}

function isZohoCampaignEnabled(): boolean {
  return readRuntimeBoolean(process.env.ZOHO_CAMPAIGNS_ENABLED);
}

/**
 * Reads the exact Zoho configuration required for blog publication from the
 * server environment without making the general application environment module
 * part of the publication capability graph.
 */
export function getZohoBlogCampaignRuntimeConfig(): ZohoBlogCampaignRuntimeConfig {
  const publicBaseUrl = getPublicBaseUrl();

  return {
    accountsServerUrl: getZohoAccountsServerUrl(),
    apiRootUrl: getZohoApiRootUrl(),
    autoSend: isZohoCampaignAutoSendEnabled(),
    clientId: getZohoCampaignClientId(),
    clientSecret: getZohoCampaignClientSecret(),
    contentSecret: getZohoCampaignContentSecret(),
    enabled: isZohoCampaignEnabled(),
    fromEmail: undefined,
    fromName: getZohoCampaignFromName(),
    listKey: undefined,
    oauthState: getZohoCampaignOauthState(),
    publicBaseUrl,
    redirectUri: getZohoRedirectUri(publicBaseUrl),
    refreshToken: undefined,
    requestTimeoutMs: getZohoRequestTimeout(),
    topicId: getZohoCampaignTopicId(),
  };
}
