import { validateBlogDiscoverImageReadiness } from '@/lib/blog-discover-readiness';

export type ScheduledPost = {
  category: string | null;
  featured_image_height: number | null;
  featured_image_url: string | null;
  featured_image_variants: Record<string, unknown> | null;
  featured_image_width: number | null;
  id: string;
  merchant_id: string;
  slug: string | null;
  title: string;
};

export type ScheduledPostReadinessIssue = {
  code: string;
  details: Record<string, unknown>;
  id: string;
  slug: string | null;
};

type MerchantFeatureSetting = {
  blog_discover_image_validation_enabled?: boolean | null;
  merchant_id: string;
};

export type EligibleScheduledPosts = {
  eligiblePosts: ScheduledPost[];
  skipped: ScheduledPostReadinessIssue[];
  warnings: ScheduledPostReadinessIssue[];
};

export function getEligibleScheduledPosts(
  scheduledPosts: ScheduledPost[],
  featureSettings: MerchantFeatureSetting[]
): EligibleScheduledPosts {
  const validationEnabledByMerchant = new Map(
    featureSettings.map((settings) => [
      settings.merchant_id,
      settings.blog_discover_image_validation_enabled === true,
    ])
  );
  const eligiblePosts: ScheduledPost[] = [];
  const skipped: ScheduledPostReadinessIssue[] = [];
  const warnings: ScheduledPostReadinessIssue[] = [];

  for (const post of scheduledPosts) {
    const readiness = validateBlogDiscoverImageReadiness(
      post,
      post.merchant_id
    );

    if (!readiness.ready) {
      const issue = {
        id: post.id,
        slug: post.slug,
        code: readiness.code,
        details: readiness.details,
      };

      if (validationEnabledByMerchant.get(post.merchant_id) === true) {
        skipped.push(issue);
        continue;
      }

      warnings.push(issue);
      console.warn(
        'Cron Warning: Scheduled blog post is not Discover image ready',
        issue
      );
    }

    eligiblePosts.push(post);
  }

  return { eligiblePosts, skipped, warnings };
}
