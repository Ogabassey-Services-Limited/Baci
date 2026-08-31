const RESERVED_CLEAN_BLOG_CATEGORY_SLUGS = new Set(['product']);
const MIN_BLOG_CATEGORY_POSTS = 3;
const BLOCKED_CATEGORY_VALUES = new Set([
  'gcrblw',
  'misc',
  'miscellaneous',
  'test',
  'uncategorized',
  'unknown',
]);
const BLOCKED_POST_TITLE_PREFIXES = ['test post'];
const BLOCKED_POST_SLUG_PARTS = ['agent-integration-working'];
const BLOG_AUTHOR_PROFILES = new Map([
  ['bassey-john', 'Bassey John'],
  ['bolakale', 'Bolakale'],
]);
const OGABASSEY_TENANT_IDENTIFIERS = new Set([
  'ogabassey',
  'ogabassey.com',
  'www.ogabassey.com',
]);

function generateStorefrontSlug(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function isPublicProjectionBlogPost(post: {
  slug: string;
  title: string;
}): boolean {
  const title = post.title.trim().toLowerCase();
  const slug = post.slug.trim().toLowerCase();
  return (
    Boolean(title && slug) &&
    !BLOCKED_POST_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix)) &&
    !BLOCKED_POST_SLUG_PARTS.some((part) => slug.includes(part))
  );
}

function isPublicCategory(category: string): boolean {
  return !BLOCKED_CATEGORY_VALUES.has(category.trim().toLowerCase());
}

/** Returns only blog category and author paths backed by live route rules. */
export function getPublicProjectionBlogSeoPaths(
  posts: readonly {
    authorName: string;
    category?: string | null;
    slug: string;
    title: string;
  }[],
  merchant: { slug: string }
): readonly string[] {
  const paths = new Set<string>();
  const categoryLabels = new Map<string, Set<string>>();
  const categoryPostCounts = new Map<string, number>();

  for (const post of posts) {
    if (!isPublicProjectionBlogPost(post)) continue;
    const category = post.category?.trim() ?? '';
    const categorySlug = generateStorefrontSlug(category);
    if (
      categorySlug &&
      isPublicCategory(category) &&
      !RESERVED_CLEAN_BLOG_CATEGORY_SLUGS.has(categorySlug)
    ) {
      const labels = categoryLabels.get(categorySlug) ?? new Set<string>();
      labels.add(category);
      categoryLabels.set(categorySlug, labels);
      categoryPostCounts.set(
        categorySlug,
        (categoryPostCounts.get(categorySlug) ?? 0) + 1
      );
    }

    if (OGABASSEY_TENANT_IDENTIFIERS.has(merchant.slug.toLowerCase())) {
      const authorSlug = generateStorefrontSlug(post.authorName);
      if (BLOG_AUTHOR_PROFILES.get(authorSlug) === post.authorName)
        paths.add(`/blog/author/${authorSlug}`);
    }
  }

  for (const [categorySlug, labels] of categoryLabels)
    if (
      labels.size === 1 &&
      (categoryPostCounts.get(categorySlug) ?? 0) >= MIN_BLOG_CATEGORY_POSTS
    )
      paths.add(`/blog/category/${categorySlug}`);

  return [...paths].sort();
}
