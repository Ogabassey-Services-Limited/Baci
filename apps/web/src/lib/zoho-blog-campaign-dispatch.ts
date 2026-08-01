import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZohoCampaignsRuntimeConfig } from '@/env';
import {
  createZohoBlogCampaign,
  refreshZohoCampaignsAccessToken,
  requireZohoRuntimeFields,
  sendZohoCampaign,
} from '@/lib/zoho-campaigns-api';
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
import { buildZohoBlogContentUrl } from './zoho-blog-content-url-server';
import { buildStorefrontBlogPostUrl } from './zoho-blog-storefront-url-server';

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
