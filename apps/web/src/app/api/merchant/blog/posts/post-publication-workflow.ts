import { after } from 'next/server';
import type { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import {
  buildIndexNowBlogPostUrl,
  getIndexNowHostFromIdentifiers,
} from '@/lib/indexnow';
import { submitConfiguredIndexNowUrls } from '@/lib/indexnow-server';
import type { dispatchZohoBlogCampaign } from '@/lib/zoho-blog-campaign-dispatch';
import { dispatchConfiguredZohoBlogCampaign } from '@/lib/zoho-blog-campaign-server';

type BlogRevalidation = Awaited<
  ReturnType<typeof getMerchantBlogRevalidationContext>
>;
type PublishedPost = Parameters<typeof dispatchZohoBlogCampaign>[0]['post'];
type PublicationEffect = Promise<unknown> | undefined;

function startIndexNowEffect({
  blogRevalidation,
  post,
}: {
  blogRevalidation: BlogRevalidation | undefined;
  post: PublishedPost;
}): PublicationEffect {
  try {
    const host = getIndexNowHostFromIdentifiers(blogRevalidation?.identifiers);
    const url = host ? buildIndexNowBlogPostUrl(host, post.slug) : null;
    return host && url
      ? submitConfiguredIndexNowUrls({ host, urls: [url] })
      : undefined;
  } catch (error) {
    console.error('IndexNow blog submit failed', error);
  }
}

function startZohoEffect({
  blogRevalidation,
  post,
  supabase,
}: {
  blogRevalidation: BlogRevalidation | undefined;
  post: PublishedPost;
  supabase: Parameters<typeof dispatchZohoBlogCampaign>[0]['supabase'];
}): PublicationEffect {
  try {
    return dispatchConfiguredZohoBlogCampaign({
      ...(blogRevalidation ? { context: blogRevalidation } : {}),
      post,
      supabase,
    });
  } catch (error) {
    console.error('Zoho Campaigns blog dispatch failed', error);
  }
}

async function logEffectResult({
  errorMessage,
  promise,
  successMessage,
}: {
  errorMessage: string;
  promise: PublicationEffect;
  successMessage: string;
}) {
  if (!promise) return;

  try {
    console.log(successMessage, await promise);
  } catch (error) {
    console.error(errorMessage, error);
  }
}

export function schedulePostPublicationWorkflow({
  blogRevalidation,
  post,
  supabase,
}: {
  blogRevalidation?: BlogRevalidation;
  post: PublishedPost;
  supabase: Parameters<typeof dispatchZohoBlogCampaign>[0]['supabase'];
}) {
  after(async () => {
    const indexNowEffect = startIndexNowEffect({ blogRevalidation, post });
    const zohoEffect = startZohoEffect({ blogRevalidation, post, supabase });

    await Promise.all([
      logEffectResult({
        errorMessage: 'IndexNow blog submit failed',
        promise: indexNowEffect,
        successMessage: 'IndexNow blog submit result',
      }),
      logEffectResult({
        errorMessage: 'Zoho Campaigns blog dispatch failed',
        promise: zohoEffect,
        successMessage: 'Zoho Campaigns blog dispatch result',
      }),
    ]);
  });
}
