import { sanitizeMarkdownText } from '@/lib/llms-markdown-sanitize';
import { normalizeOrigin } from '@/lib/normalize-origin';

const BLOG_INDEX_EXCERPT_FALLBACK = 'Published blog post';
const BLOG_INDEX_TITLE_FALLBACK = 'Untitled post';
const BLOG_INDEX_HEADING_FALLBACK = 'Blog';
const BLOG_INDEX_DESCRIPTION_FALLBACK =
  'Latest published articles and editorial content.';
const MAX_BLOG_INDEX_POSTS = 24;

type MarkdownLine = string | false | null | undefined;

interface BlogListPost {
  title: string;
  slug: string;
  excerpt?: string | null;
  reading_time_minutes?: number | null;
}

function joinMarkdownLines(lines: MarkdownLine[]): string {
  return lines
    .filter((line): line is string => line !== false && line != null)
    .join('\n');
}

function formatReadingTime(minutes: number | null | undefined): string {
  if (
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return '';
  }

  return ` (${Math.round(minutes)} min read)`;
}

function isRenderableBlogPost(
  post: BlogListPost | null | undefined
): post is BlogListPost {
  return (
    post != null &&
    typeof post.title === 'string' &&
    typeof post.slug === 'string' &&
    post.slug.trim().length > 0
  );
}

export function buildBlogIndexMarkdown(
  merchant: { business_name?: string | null },
  origin: string,
  posts: BlogListPost[],
  categories: string[]
): string {
  const normalizedOrigin = normalizeOrigin(origin);
  const businessName = sanitizeMarkdownText(merchant.business_name);
  const heading = businessName
    ? `${businessName} Blog`
    : BLOG_INDEX_HEADING_FALLBACK;
  const description = businessName
    ? `Latest published articles and editorial content from ${businessName}.`
    : BLOG_INDEX_DESCRIPTION_FALLBACK;
  const safeCategories = (Array.isArray(categories) ? categories : [])
    .filter((category): category is string => typeof category === 'string')
    .map((category) => sanitizeMarkdownText(category))
    .filter(Boolean);
  const safePosts = Array.isArray(posts) ? posts : [];

  return joinMarkdownLines([
    `# ${heading}`,
    '',
    `> ${description}`,
    '',
    `- Blog URL: ${normalizedOrigin}/blog`,
    `- Markdown mirror: ${normalizedOrigin}/blog/index.html.md`,
    safeCategories.length > 0
      ? `- Categories: ${safeCategories.join(', ')}`
      : false,
    '',
    '## Posts',
    ...safePosts
      .filter(isRenderableBlogPost)
      .slice(0, MAX_BLOG_INDEX_POSTS)
      .map((post) => {
        const title =
          sanitizeMarkdownText(post.title) || BLOG_INDEX_TITLE_FALLBACK;
        const excerpt =
          sanitizeMarkdownText(post.excerpt) || BLOG_INDEX_EXCERPT_FALLBACK;
        const slug = encodeURIComponent(post.slug.trim());

        return `- [${title}](${normalizedOrigin}/blog/${slug}.md): ${excerpt}${formatReadingTime(post.reading_time_minutes)}`;
      }),
    '',
  ]);
}
