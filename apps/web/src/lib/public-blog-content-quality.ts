interface PublicBlogPostCandidate {
  slug?: string | null;
  title?: string | null;
}

export const BLOCKED_PUBLIC_BLOG_CATEGORY_VALUES = [
  'gcrblw',
  'misc',
  'miscellaneous',
  'test',
  'uncategorized',
  'unknown',
] as const;

const BLOCKED_CATEGORY_VALUES = new Set<string>(
  BLOCKED_PUBLIC_BLOG_CATEGORY_VALUES
);

export const BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES = ['test post'] as const;
export const BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS = [
  'agent-integration-working',
] as const;

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isPublicBlogCategory(
  category: string | null | undefined
): boolean {
  const normalized = normalizeText(category);
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (BLOCKED_CATEGORY_VALUES.has(lowered)) {
    return false;
  }

  return true;
}

export function filterPublicBlogCategories(
  categories: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const publicCategories: string[] = [];

  for (const category of categories) {
    const normalized = normalizeText(category);
    const key = normalized.toLowerCase();
    if (!isPublicBlogCategory(normalized) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    publicCategories.push(normalized);
  }

  return publicCategories;
}

export function isPublicBlogPost(post: PublicBlogPostCandidate): boolean {
  const title = normalizeText(post.title);
  const slug = normalizeText(post.slug);
  if (!title || !slug) {
    return false;
  }

  const loweredTitle = title.toLowerCase();
  const loweredSlug = slug.toLowerCase();
  if (
    BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES.some((prefix) =>
      loweredTitle.startsWith(prefix)
    )
  ) {
    return false;
  }

  return !BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS.some((part) =>
    loweredSlug.includes(part)
  );
}

export function filterPublicBlogPosts<T extends PublicBlogPostCandidate>(
  posts: T[]
): T[] {
  return posts.filter(isPublicBlogPost);
}
