import { getBlogPostTextPreview } from '@/lib/blog-utils';
import { sanitizeMarkdownText } from '@/lib/llms-markdown-sanitize';
import { normalizeOrigin } from '@/lib/normalize-origin';

const BLOG_POST_PREVIEW_LENGTH = 600;
const BLOG_POST_FALLBACK_TEXT = 'Read this post.';
const BLOG_POST_TITLE_FALLBACK = 'Untitled post';

type MarkdownLine = string | false | null | undefined;

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

function joinMarkdownLines(lines: MarkdownLine[]): string {
  return lines
    .filter((line): line is string => line !== false && line != null)
    .join('\n');
}

function formatReadingTime(minutes: number | null | undefined): string | false {
  if (
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return false;
  }

  return `- Reading time: ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export function buildBlogPostMarkdown(
  merchant: { business_name?: string | null },
  origin: string,
  post: BlogPostMarkdownInput
): string {
  const normalizedOrigin = normalizeOrigin(origin);
  const preview =
    post.excerpt ||
    getBlogPostTextPreview(
      post.content,
      BLOG_POST_PREVIEW_LENGTH,
      BLOG_POST_FALLBACK_TEXT
    );
  const businessName = sanitizeMarkdownText(merchant.business_name);
  const title = sanitizeMarkdownText(post.title) || BLOG_POST_TITLE_FALLBACK;
  const safePreview = sanitizeMarkdownText(preview) || BLOG_POST_FALLBACK_TEXT;
  const authorName = sanitizeMarkdownText(post.author_name);
  const category = sanitizeMarkdownText(post.category);
  const publishedAt = sanitizeMarkdownText(post.published_at);
  const tags = post.tags
    ?.map((tag) => sanitizeMarkdownText(tag))
    .filter(Boolean);
  const trimmedSlug = post.slug.trim();
  const slug = trimmedSlug ? encodeURIComponent(trimmedSlug) : '';

  return joinMarkdownLines([
    `# ${title}`,
    '',
    `> ${safePreview}`,
    '',
    '## Summary',
    businessName ? `- Publisher: ${businessName}` : false,
    authorName ? `- Author: ${authorName}` : false,
    category ? `- Category: ${category}` : false,
    publishedAt ? `- Published: ${publishedAt}` : false,
    formatReadingTime(post.reading_time_minutes),
    tags && tags.length > 0 ? `- Tags: ${tags.join(', ')}` : false,
    slug ? `- Canonical blog URL: ${normalizedOrigin}/blog/${slug}` : false,
    slug ? `- Markdown mirror: ${normalizedOrigin}/blog/${slug}.md` : false,
    '',
  ]);
}
