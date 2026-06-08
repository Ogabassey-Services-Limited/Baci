import type { ZohoCampaignsRuntimeConfig } from '@/env';
import {
  describeZohoPayload,
  postZohoForm,
  readJsonResponse,
  requireZohoOAuthFields,
  toFormBody,
  trimTrailingSlash,
  zohoCreateCampaignResponseSchema,
  zohoSendCampaignResponseSchema,
  zohoTokenResponseSchema,
} from '@/lib/zoho-campaigns-http';
import {
  type FetchImplementation,
  type ZohoCampaignCreateInput,
  ZohoCampaignsError,
} from '@/lib/zoho-campaigns-types';

export function requireZohoRuntimeFields(
  config: ZohoCampaignsRuntimeConfig
): string[] {
  const missing = requireZohoTokenRefreshFields(config);
  if (!config.fromEmail) missing.push('ZOHO_CAMPAIGNS_FROM_EMAIL');
  if (!config.listKey) missing.push('ZOHO_CAMPAIGNS_LIST_KEY');
  if (!config.contentSecret) missing.push('ZOHO_CAMPAIGNS_CONTENT_SECRET');
  return missing;
}

export function requireZohoTokenRefreshFields(
  config: ZohoCampaignsRuntimeConfig
): string[] {
  const missing = requireZohoOAuthFields(config);
  if (!config.refreshToken) missing.push('ZOHO_CAMPAIGNS_REFRESH_TOKEN');
  return missing;
}

export async function refreshZohoCampaignsAccessToken(
  config: ZohoCampaignsRuntimeConfig,
  fetchImpl: FetchImplementation = fetch
): Promise<string> {
  const missing = requireZohoTokenRefreshFields(config);
  if (missing.length > 0) {
    throw new ZohoCampaignsError(
      `Missing Zoho Campaigns token refresh config: ${missing.join(', ')}`
    );
  }

  const response = await fetchImpl(
    `${trimTrailingSlash(config.accountsServerUrl)}/oauth/v2/token`,
    {
      body: toFormBody({
        client_id: config.clientId as string,
        client_secret: config.clientSecret as string,
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken as string,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }
  );
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    const details = describeZohoPayload(payload);
    throw new ZohoCampaignsError(
      details
        ? `Zoho OAuth token refresh failed: ${details}`
        : 'Zoho OAuth token refresh failed',
      { statusCode: response.status }
    );
  }

  return zohoTokenResponseSchema.parse(payload).access_token;
}

export async function subscribeZohoContactToList({
  accessToken,
  apiRootUrl,
  contactInfo,
  fetchImpl,
  listKey,
}: {
  accessToken: string;
  apiRootUrl: string;
  contactInfo: Record<string, string>;
  fetchImpl: FetchImplementation;
  listKey: string;
}) {
  const normalizedListKey = listKey.trim();
  if (!normalizedListKey) {
    throw new ZohoCampaignsError('Missing Zoho Campaigns list key');
  }

  await postZohoForm(
    `${trimTrailingSlash(apiRootUrl)}/listsubscribe`,
    toFormBody({
      contactinfo: JSON.stringify(contactInfo),
      listkey: normalizedListKey,
      resfmt: 'JSON',
    }),
    accessToken,
    fetchImpl
  );
}

export async function createZohoBlogCampaign({
  accessToken,
  blogUrl,
  config,
  contentUrl,
  fetchImpl,
  post,
}: ZohoCampaignCreateInput): Promise<string> {
  const missing = requireZohoRuntimeFields(config);
  if (missing.length > 0) {
    throw new ZohoCampaignsError(
      `Missing Zoho Campaigns runtime config: ${missing.join(', ')}`
    );
  }

  const payload = await postZohoForm(
    `${trimTrailingSlash(config.apiRootUrl)}/createCampaign`,
    toFormBody({
      campaignname: `Blog: ${post.title ?? post.slug ?? post.id}`.slice(0, 120),
      content_url: contentUrl,
      from_email: config.fromEmail as string,
      from_name: config.fromName,
      list_details: JSON.stringify({ [config.listKey as string]: [] }),
      resfmt: 'JSON',
      subject: (
        post.title ?? `New ${config.fromName} article: ${blogUrl}`
      ).slice(0, 150),
      ...(config.topicId ? { topicId: config.topicId } : {}),
    }),
    accessToken,
    fetchImpl
  );
  const parsed = zohoCreateCampaignResponseSchema.parse(payload);
  if (!parsed.campaignKey) {
    throw new ZohoCampaignsError('Zoho Campaigns did not return campaignKey');
  }
  return parsed.campaignKey;
}

export async function sendZohoCampaign({
  accessToken,
  apiRootUrl,
  campaignKey,
  fetchImpl,
}: {
  accessToken: string;
  apiRootUrl: string;
  campaignKey: string;
  fetchImpl: FetchImplementation;
}) {
  const normalizedCampaignKey = campaignKey.trim();
  if (!normalizedCampaignKey) {
    throw new ZohoCampaignsError('Missing Zoho Campaigns campaign key');
  }

  const payload = await postZohoForm(
    `${trimTrailingSlash(apiRootUrl)}/sendcampaign`,
    toFormBody({ campaignkey: normalizedCampaignKey, resfmt: 'JSON' }),
    accessToken,
    fetchImpl
  );
  zohoSendCampaignResponseSchema.parse(payload);
}
