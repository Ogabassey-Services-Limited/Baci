import type { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { schedulePrewarmBlogImageTransforms } from '@/lib/ogabassey-blog-image-prewarm';
import type { dispatchZohoBlogCampaign } from '@/lib/zoho-blog-campaign-dispatch';
import { schedulePostPublicationWorkflow } from './post-publication-workflow';

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
  if (post.featured_image_url) {
    schedulePrewarmBlogImageTransforms([post.featured_image_url]);
  }
  schedulePostPublicationWorkflow({ blogRevalidation, post, supabase });
}
