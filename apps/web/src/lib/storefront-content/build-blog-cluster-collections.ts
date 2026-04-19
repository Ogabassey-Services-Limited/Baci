import type {
  BlogClusterCollection,
  InformationalGuideLink,
  PublishedClusterPost,
  SupportedClusterCategory,
} from './content-cluster-types';
import { inferContentClusterContext } from './infer-content-cluster-context';

const COLLECTION_HEADINGS: Record<SupportedClusterCategory, string> = {
  smartphones: 'Smartphone buying guides',
  laptops: 'Laptop buying guides',
  'smart-tvs': 'Smart TV buying guides',
};

function toPublishedTimestamp(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function toGuideLink(
  storeUrl: string,
  post: PublishedClusterPost,
  kind: InformationalGuideLink['kind']
): InformationalGuideLink {
  return {
    href: `${storeUrl}/blog/${post.slug}`,
    title: post.title,
    description:
      post.excerpt?.trim() ||
      (post.reading_time_minutes
        ? `${post.reading_time_minutes} minute guide`
        : 'Read the full guide'),
    kind,
  };
}

export function buildBlogClusterCollections(input: {
  storeUrl: string;
  posts: PublishedClusterPost[];
}): BlogClusterCollection[] {
  const grouped = new Map<SupportedClusterCategory, InformationalGuideLink[]>();

  for (const post of input.posts) {
    const inferred = inferContentClusterContext(post);

    if (!inferred.categorySlug || !inferred.kind) {
      continue;
    }

    const guides = grouped.get(inferred.categorySlug) ?? [];
    guides.push(toGuideLink(input.storeUrl, post, inferred.kind));
    grouped.set(inferred.categorySlug, guides);
  }

  return (['smartphones', 'laptops', 'smart-tvs'] as SupportedClusterCategory[])
    .map((categorySlug) => {
      const guides = (grouped.get(categorySlug) ?? [])
        .slice()
        .sort((left, right) => {
          const leftPublished = toPublishedTimestamp(
            input.posts.find(
              (post) => `${input.storeUrl}/blog/${post.slug}` === left.href
            )?.published_at ?? null
          );
          const rightPublished = toPublishedTimestamp(
            input.posts.find(
              (post) => `${input.storeUrl}/blog/${post.slug}` === right.href
            )?.published_at ?? null
          );

          return (
            rightPublished - leftPublished ||
            left.href.localeCompare(right.href)
          );
        })
        .slice(0, 3);

      if (guides.length < 2) {
        return null;
      }

      return {
        categorySlug,
        heading: COLLECTION_HEADINGS[categorySlug],
        categoryHref: `${input.storeUrl}/${categorySlug}`,
        guides,
      } satisfies BlogClusterCollection;
    })
    .filter((collection): collection is BlogClusterCollection =>
      Boolean(collection)
    );
}
