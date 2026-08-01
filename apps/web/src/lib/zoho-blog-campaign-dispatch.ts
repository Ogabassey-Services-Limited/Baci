import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZohoCampaignsRuntimeConfig } from '@/env';
import {
  createZohoBlogCampaign,
  refreshZohoCampaignsAccessToken,
  requireZohoRuntimeFields,
  sendZohoCampaign,
} from '@/lib/zoho-campaigns-api';
import { trimTrailingSlash } from '@/lib/zoho-campaigns-http';
import type {
  FetchImplementation,
  ZohoBlogCampaignPost,
  ZohoCampaignDispatchResult,
} from '@/lib/zoho-campaigns-types';
import { ZohoCampaignsError } from '@/lib/zoho-campaigns-types';
import {
  getMerchantBlogRevalidationContext,
  type MerchantBlogRevalidationContext,
} from './get-merchant-blog-cache-identifiers';
import { resolveMerchantZohoCampaignConfig } from './merchant-zoho-campaign-settings';

const HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const DEFAULT_ZOHO_REQUEST_TIMEOUT_MS = 15_000;

type ZohoBlogCampaignAudience = 'primary' | 'review';

export type ZohoBlogCampaignDispatchInput = {
  audience?: ZohoBlogCampaignAudience;
  config: ZohoCampaignsRuntimeConfig;
  context?: MerchantBlogRevalidationContext;
  fetchImpl?: FetchImplementation;
  post: ZohoBlogCampaignPost;
  supabase: SupabaseClient;
};

function withZohoRequestTimeout(
  fetchImpl: FetchImplementation,
  timeoutMs: number
): FetchImplementation {
  return async (input, init) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    if (upstreamSignal?.aborted) {
      controller.abort();
    } else {
      upstreamSignal?.addEventListener('abort', abortFromUpstream, {
        once: true,
      });
    }

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ZohoCampaignsError(
          `Zoho Campaigns request timed out after ${timeoutMs}ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  };
}

function normalizeCustomDomainIdentifier(identifier: string): string | null {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed || trimmed.includes('/')) return null;

  try {
    const parsed = new URL(`https://${trimmed}`);
    const hostname = parsed.hostname;
    if (hostname !== trimmed || !hostname.includes('.')) return null;
    return HOSTNAME_PATTERN.test(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

export function buildStorefrontBlogPostUrl({
  context,
  publicBaseUrl,
  slug,
}: {
  context: MerchantBlogRevalidationContext;
  publicBaseUrl: string;
  slug: string;
}): string {
  const customDomain =
    context.identifiers
      .map((identifier) => normalizeCustomDomainIdentifier(identifier))
      .find((identifier): identifier is string => Boolean(identifier)) ?? null;
  const origin = customDomain
    ? `https://${customDomain}`
    : trimTrailingSlash(publicBaseUrl);
  const pathPrefix =
    customDomain || !context.canonicalMerchantSlug
      ? ''
      : `/${context.canonicalMerchantSlug}`;

  return `${trimTrailingSlash(origin)}${pathPrefix}/blog/${encodeURIComponent(slug)}`;
}

export function buildZohoBlogContentUrl({
  contentSecret,
  postId,
  publicBaseUrl,
}: {
  contentSecret: string;
  postId: string;
  publicBaseUrl: string;
}): string {
  const url = new URL(
    `/api/integrations/zoho/blog-content/${encodeURIComponent(postId)}`,
    `${trimTrailingSlash(publicBaseUrl)}/`
  );
  url.searchParams.set(
    'sig',
    buildZohoBlogContentSignature({ contentSecret, postId })
  );
  return url.toString();
}

export function buildZohoBlogContentSignature({
  contentSecret,
  postId,
}: {
  contentSecret: string;
  postId: string;
}): string {
  return createHmac('sha256', contentSecret).update(postId).digest('hex');
}

export function isValidZohoBlogContentSignature({
  contentSecret,
  postId,
  signature,
}: {
  contentSecret: string;
  postId: string;
  signature: string | null;
}): boolean {
  if (!signature) return false;
  const expected = buildZohoBlogContentSignature({ contentSecret, postId });
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

export async function dispatchZohoBlogCampaign({
  audience = 'primary',
  config,
  context,
  fetchImpl = fetch,
  post,
  supabase,
}: ZohoBlogCampaignDispatchInput): Promise<ZohoCampaignDispatchResult> {
  if (!config.enabled) {
    return {
      postId: post.id,
      reason: 'Zoho Campaigns disabled',
      status: 'skipped',
    };
  }
  if (!post.slug) {
    return {
      postId: post.id,
      reason: 'Blog post has no slug',
      status: 'skipped',
    };
  }

  let campaignKey: string | undefined;
  try {
    const merchantConfig = await resolveMerchantZohoCampaignConfig({
      config,
      merchantId: post.merchant_id,
      supabase,
    });

    if (merchantConfig.status === 'skipped') {
      return {
        postId: post.id,
        reason: merchantConfig.reason,
        status: 'skipped',
      };
    }

    const effectiveConfig =
      audience === 'review'
        ? {
            ...merchantConfig.config,
            autoSend: true,
            listKey: merchantConfig.reviewListKey,
          }
        : merchantConfig.config;

    if (audience === 'review' && !effectiveConfig.listKey) {
      return {
        postId: post.id,
        reason: 'Missing Zoho Campaigns merchant settings: reviewListKey',
        status: 'skipped',
      };
    }

    const missing = requireZohoRuntimeFields(effectiveConfig);
    if (missing.length > 0) {
      return {
        postId: post.id,
        reason: `Missing Zoho Campaigns config: ${missing.join(', ')}`,
        status: 'skipped',
      };
    }

    const timedFetch = withZohoRequestTimeout(
      fetchImpl,
      effectiveConfig.requestTimeoutMs || DEFAULT_ZOHO_REQUEST_TIMEOUT_MS
    );
    const resolvedContext =
      context ??
      (await getMerchantBlogRevalidationContext(supabase, post.merchant_id));
    const blogUrl = buildStorefrontBlogPostUrl({
      context: resolvedContext,
      publicBaseUrl: effectiveConfig.publicBaseUrl,
      slug: post.slug,
    });
    const contentUrl = buildZohoBlogContentUrl({
      contentSecret: effectiveConfig.contentSecret as string,
      postId: post.id,
      publicBaseUrl: effectiveConfig.publicBaseUrl,
    });
    const accessToken = await refreshZohoCampaignsAccessToken(
      effectiveConfig,
      timedFetch
    );
    campaignKey = await createZohoBlogCampaign({
      accessToken,
      blogUrl,
      config: effectiveConfig,
      contentUrl,
      fetchImpl: timedFetch,
      post,
    });

    if (!effectiveConfig.autoSend) {
      return { campaignKey, contentUrl, postId: post.id, status: 'created' };
    }

    await sendZohoCampaign({
      accessToken,
      apiRootUrl: effectiveConfig.apiRootUrl,
      campaignKey,
      fetchImpl: timedFetch,
    });
    return { campaignKey, contentUrl, postId: post.id, status: 'sent' };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Zoho error';
    console.error('Zoho Campaigns blog dispatch failed', {
      campaignKey,
      error: message,
      postId: post.id,
    });
    return { campaignKey, error: message, postId: post.id, status: 'failed' };
  }
}
