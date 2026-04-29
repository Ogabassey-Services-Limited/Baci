import { getBlogPostTextPreview } from '@/lib/blog-utils';
import { sanitizeMarkdownText } from '@/lib/llms-markdown-sanitize';

const BLOG_POST_PREVIEW_LENGTH = 600;
const BLOG_POST_FALLBACK_TEXT = 'Read this post.';
const BLOG_INDEX_EXCERPT_FALLBACK = 'Published blog post';
const MAX_BLOG_INDEX_POSTS = 24;

type MarkdownLine = string | false | null | undefined;

function joinMarkdownLines(lines: MarkdownLine[]): string {
  return lines
    .filter((line): line is string => line !== false && line != null)
    .join('\n');
}

function formatReadingTime(
  minutes: number | null | undefined,
  label: 'short' | 'long'
): string | false {
  if (
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return false;
  }

  return label === 'short'
    ? ` (${minutes} min read)`
    : `- Reading time: ${minutes} minutes`;
}

interface BlogListPost {
  title: string;
  slug: string;
  excerpt?: string | null;
  category?: string | null;
  author_name?: string | null;
  published_at?: string | null;
  reading_time_minutes?: number | null;
}

export function buildBlogIndexMarkdown(
  merchant: { business_name: string; slug: string },
  origin: string,
  posts: BlogListPost[],
  categories: string[]
): string {
  const businessName = sanitizeMarkdownText(merchant.business_name);
  const safeCategories = categories
    .map((category) => sanitizeMarkdownText(category))
    .filter(Boolean);

  return joinMarkdownLines([
    `# ${businessName} Blog`,
    '',
    `> Latest published articles and editorial content from ${businessName}.`,
    '',
    `- Blog URL: ${origin}/blog`,
    `- Markdown mirror: ${origin}/blog/index.html.md`,
    safeCategories.length > 0
      ? `- Categories: ${safeCategories.join(', ')}`
      : false,
    '',
    '## Posts',
    ...posts.slice(0, MAX_BLOG_INDEX_POSTS).map((post) => {
      const title = sanitizeMarkdownText(post.title);
      const excerpt =
        sanitizeMarkdownText(post.excerpt) || BLOG_INDEX_EXCERPT_FALLBACK;
      const readingTime = formatReadingTime(post.reading_time_minutes, 'short');
      const slug = encodeURIComponent(post.slug);

      return `- [${title}](${origin}/blog/${slug}.md): ${excerpt}${readingTime || ''}`;
    }),
    '',
  ]);
}

interface BlogPostMarkdownInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: unknown;
  category?: string | null;
  author_name?: string | null;
  published_at?: string | null;
  reading_time_minutes?: number | null;
  tags?: string[] | null;
}

export function buildBlogPostMarkdown(
  merchant: { business_name: string },
  origin: string,
  post: BlogPostMarkdownInput
): string {
  const preview =
    post.excerpt ||
    getBlogPostTextPreview(
      post.content,
      BLOG_POST_PREVIEW_LENGTH,
      BLOG_POST_FALLBACK_TEXT
    );
  const businessName = sanitizeMarkdownText(merchant.business_name);
  const title = sanitizeMarkdownText(post.title);
  const safePreview = sanitizeMarkdownText(preview) || BLOG_POST_FALLBACK_TEXT;
  const authorName = sanitizeMarkdownText(post.author_name);
  const category = sanitizeMarkdownText(post.category);
  const publishedAt = sanitizeMarkdownText(post.published_at);
  const tags = post.tags
    ?.map((tag) => sanitizeMarkdownText(tag))
    .filter(Boolean);
  const slug = encodeURIComponent(post.slug);

  return joinMarkdownLines([
    `# ${title}`,
    '',
    `> ${safePreview}`,
    '',
    '## Summary',
    `- Publisher: ${businessName}`,
    authorName ? `- Author: ${authorName}` : false,
    category ? `- Category: ${category}` : false,
    publishedAt ? `- Published: ${publishedAt}` : false,
    formatReadingTime(post.reading_time_minutes, 'long'),
    tags && tags.length > 0 ? `- Tags: ${tags.join(', ')}` : false,
    `- Canonical blog URL: ${origin}/blog/${slug}`,
    `- Markdown mirror: ${origin}/blog/${slug}.md`,
    '',
  ]);
}
