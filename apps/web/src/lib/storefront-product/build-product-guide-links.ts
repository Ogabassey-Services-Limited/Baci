import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import { buildCommercialGuideLinks } from '@/lib/storefront-content/build-commercial-guide-links';
import type {
  ContentClusterKind,
  InformationalGuideLink,
  PublishedClusterPost,
  SupportedClusterCategory,
} from '@/lib/storefront-content/content-cluster-types';
import { inferContentClusterContext } from '@/lib/storefront-content/infer-content-cluster-context';
import type { BuildProductSemanticModelInput } from './product-semantic-types';

function dedupeGuideLinks(links: ReturnType<typeof buildCommercialGuideLinks>) {
  const seen = new Set<string>();

  return links.filter((link) => {
    if (seen.has(link.href)) {
      return false;
    }

    seen.add(link.href);
    return true;
  });
}

function buildGuideDescription(post: PublishedClusterPost) {
  const excerpt = post.excerpt?.trim();

  if (excerpt) {
    return excerpt;
  }

  return post.reading_time_minutes
    ? `${post.reading_time_minutes} minute guide`
    : 'Read the full guide';
}

function inferPriorityGuideKind(
  post: PublishedClusterPost
): ContentClusterKind {
  return inferContentClusterContext(post).kind ?? 'buyer-guide';
}

function buildPriorityProductGuideLinks(input: {
  posts: PublishedClusterPost[];
  storeUrl: string;
}): InformationalGuideLink[] {
  return input.posts.map((post) => ({
    href: `${input.storeUrl}/blog/${post.slug}`,
    title: post.title,
    description: buildGuideDescription(post),
    kind: inferPriorityGuideKind(post),
  }));
}

export function buildProductGuideLinks(input: BuildProductSemanticModelInput) {
  if (!(input.categorySlug in CONTENT_CLUSTER_SUPPORT)) {
    return [];
  }

  const guidePosts = input.guidePosts ?? [];
  const priorityGuidePostSlugs = new Set(input.priorityGuidePostSlugs ?? []);
  const priorityGuidePosts = guidePosts.filter((post) =>
    priorityGuidePostSlugs.has(post.slug)
  );
  const fallbackGuidePosts = guidePosts.filter(
    (post) => !priorityGuidePostSlugs.has(post.slug)
  );

  return dedupeGuideLinks([
    ...buildPriorityProductGuideLinks({
      storeUrl: input.storeUrl,
      posts: priorityGuidePosts,
    }),
    ...buildCommercialGuideLinks({
      storeUrl: input.storeUrl,
      posts: fallbackGuidePosts,
      context: {
        pageKind: 'product',
        categorySlug: input.categorySlug as SupportedClusterCategory,
        brands: input.currentProduct.brand ? [input.currentProduct.brand] : [],
        productNames: [input.currentProduct.name],
        productSlugs: [input.currentProduct.slug],
      },
    }),
  ]).slice(0, 3);
}
