import type { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { schedulePrewarmBlogImageTransforms } from '@/lib/ogabassey-blog-image-prewarm';
import type { dispatchZohoBlogCampaign } from '@/lib/zoho-blog-campaign-dispatch';
import { schedulePostPublicationWorkflow } from '../post-publication-workflow';

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
  schedulePostPublicationWorkflow({ blogRevalidation, post, supabase });
}
