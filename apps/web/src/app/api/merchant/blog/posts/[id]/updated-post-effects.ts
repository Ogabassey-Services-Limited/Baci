import { after } from 'next/server';
import type { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import {
  buildIndexNowBlogPostUrl,
  getIndexNowHostFromIdentifiers,
  submitIndexNowUrls,
} from '@/lib/indexnow';
import { schedulePrewarmBlogImageTransforms } from '@/lib/ogabassey-blog-image-prewarm';
import { dispatchZohoBlogCampaign } from '@/lib/zoho-blog-campaign-dispatch';

type BlogRevalidation = Awaited<
  ReturnType<typeof getMerchantBlogRevalidationContext>
>;
type PublishedPost = Parameters<typeof dispatchZohoBlogCampaign>[0]['post'] & {
  featured_image_url: string | null;
  status: string;
};

export function scheduleUpdatedPostEffects({
  blogRevalidation,
  featuredImageUrlChanged,
  post,
  publishingNow,
  supabase,
}: {
  blogRevalidation: BlogRevalidation | undefined;
  featuredImageUrlChanged: boolean;
  post: PublishedPost;
  publishingNow: boolean;
  supabase: Parameters<typeof dispatchZohoBlogCampaign>[0]['supabase'];
}) {
  if (
    post.status === 'published' &&
    post.featured_image_url &&
    (featuredImageUrlChanged || publishingNow)
  ) {
    schedulePrewarmBlogImageTransforms([post.featured_image_url]);
  }
  if (!publishingNow) return;

  after(async () => {
    const indexNowHost = getIndexNowHostFromIdentifiers(
      blogRevalidation?.identifiers
    );
    const indexNowUrl = indexNowHost
      ? buildIndexNowBlogPostUrl(indexNowHost, post.slug)
      : null;
    const indexNowPromise =
      indexNowHost && indexNowUrl
        ? submitIndexNowUrls({ host: indexNowHost, urls: [indexNowUrl] })
        : undefined;
    let zohoDispatchPromise:
      | ReturnType<typeof dispatchZohoBlogCampaign>
      | undefined;
    try {
      zohoDispatchPromise = dispatchZohoBlogCampaign({
        ...(blogRevalidation ? { context: blogRevalidation } : {}),
        post,
        supabase,
      });
    } catch (error) {
      console.error('Zoho Campaigns blog dispatch failed', error);
    }
    if (indexNowPromise) {
      try {
        console.log('IndexNow blog submit result', await indexNowPromise);
      } catch (error) {
        console.error('IndexNow blog submit failed', error);
      }
    }
    if (zohoDispatchPromise) {
      try {
        console.log(
          'Zoho Campaigns blog dispatch result',
          await zohoDispatchPromise
        );
      } catch (error) {
        console.error('Zoho Campaigns blog dispatch failed', error);
      }
    }
  });
}
