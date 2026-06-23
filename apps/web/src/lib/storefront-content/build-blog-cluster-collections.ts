import type {
  BlogClusterCollection,
  InformationalGuideLink,
  PublishedClusterPost,
  SupportedClusterCategory,
} from './content-cluster-types';
import { inferContentClusterContext } from './infer-content-cluster-context';

const COLLECTION_HEADINGS: Record<SupportedClusterCategory, string> = {
  accessories: 'Accessory buying guides',
  audio: 'Audio buying guides',
  'childrens-tablets': 'Kids tablet buying guides',
  desktops: 'Desktop buying guides',
  earbuds: 'Earbud buying guides',
  gaming: 'Gaming buying guides',
  'gaming-accessories': 'Gaming accessory guides',
  'gaming-laptops': 'Gaming laptop buying guides',
  'gift-cards': 'Gift card guides',
  laptops: 'Laptop buying guides',
  'lg-tvs': 'LG TV buying guides',
  monitors: 'Monitor buying guides',
  'nintendo-switch': 'Nintendo Switch buying guides',
  'nintendo-switch-2': 'Nintendo Switch 2 buying guides',
  'playstation-4': 'PlayStation 4 buying guides',
  'playstation-5': 'PlayStation 5 buying guides',
  'portable-gaming': 'Portable gaming guides',
  printers: 'Printer buying guides',
  'samsung-tvs': 'Samsung TV buying guides',
  'smart-tvs': 'Smart TV buying guides',
  smartphones: 'Smartphone buying guides',
  smartwatches: 'Smartwatch buying guides',
  tablets: 'Tablet buying guides',
  'vr-headsets': 'VR headset buying guides',
  wearables: 'Wearable buying guides',
  xbox: 'Xbox buying guides',
};

const COLLECTION_ORDER: SupportedClusterCategory[] = [
  'smartphones',
  'laptops',
  'gaming-laptops',
  'tablets',
  'audio',
  'earbuds',
  'smartwatches',
  'wearables',
  'gaming',
  'playstation-5',
  'playstation-4',
  'nintendo-switch',
  'nintendo-switch-2',
  'portable-gaming',
  'xbox',
  'gift-cards',
  'printers',
  'monitors',
  'samsung-tvs',
  'lg-tvs',
  'smart-tvs',
  'accessories',
  'gaming-accessories',
  'desktops',
  'childrens-tablets',
  'vr-headsets',
];

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
  const publishedTimestampsByHref = new Map<string, number>();

  for (const post of input.posts) {
    publishedTimestampsByHref.set(
      `${input.storeUrl}/blog/${post.slug}`,
      toPublishedTimestamp(post.published_at)
    );

    const inferred = inferContentClusterContext(post);

    if (!inferred.categorySlug || !inferred.kind) {
      continue;
    }

    const guides = grouped.get(inferred.categorySlug) ?? [];
    guides.push(toGuideLink(input.storeUrl, post, inferred.kind));
    grouped.set(inferred.categorySlug, guides);
  }

  return COLLECTION_ORDER.map((categorySlug) => {
    const guides = (grouped.get(categorySlug) ?? [])
      .slice()
      .sort((left, right) => {
        const leftPublished = publishedTimestampsByHref.get(left.href) ?? 0;
        const rightPublished = publishedTimestampsByHref.get(right.href) ?? 0;

        return (
          rightPublished - leftPublished || left.href.localeCompare(right.href)
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
  }).filter((collection): collection is BlogClusterCollection =>
    Boolean(collection)
  );
}
