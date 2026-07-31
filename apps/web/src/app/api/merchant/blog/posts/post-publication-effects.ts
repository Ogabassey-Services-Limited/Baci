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
};

export function scheduleCreatedPostPublicationEffects({
  blogRevalidation,
  post,
  supabase,
}: {
  blogRevalidation: BlogRevalidation | undefined;
  post: PublishedPost;
  supabase: Parameters<typeof dispatchZohoBlogCampaign>[0]['supabase'];
}) {
  schedulePrewarmBlogImageTransforms([post.featured_image_url]);
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
