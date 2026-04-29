import { getBlogPostTextPreview } from '@/lib/blog-utils';

const BLOG_POST_PREVIEW_LENGTH = 600;
const BLOG_POST_FALLBACK_TEXT = 'Read this post.';
const MAX_BLOG_INDEX_POSTS = 24;

type MarkdownLine = string | false | null | undefined;

function joinMarkdownLines(lines: MarkdownLine[]): string {
  return lines
    .filter((line): line is string => line !== false && line != null)
    .join('\n');
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
  return joinMarkdownLines([
    `# ${merchant.business_name} Blog`,
    '',
    `> Latest published articles and editorial content from ${merchant.business_name}.`,
    '',
    `- Blog URL: ${origin}/blog`,
    `- Markdown mirror: ${origin}/blog/index.html.md`,
    categories.length > 0 ? `- Categories: ${categories.join(', ')}` : false,
    '',
    '## Posts',
    ...posts
      .slice(0, MAX_BLOG_INDEX_POSTS)
      .flatMap((post) => [
        `- [${post.title}](${origin}/blog/${post.slug}.md): ${post.excerpt || 'Published blog post'}${post.reading_time_minutes ? ` (${post.reading_time_minutes} min read)` : ''}`,
      ]),
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

  return joinMarkdownLines([
    `# ${post.title}`,
    '',
    `> ${preview}`,
    '',
    '## Summary',
    `- Publisher: ${merchant.business_name}`,
    post.author_name ? `- Author: ${post.author_name}` : false,
    post.category ? `- Category: ${post.category}` : false,
    post.published_at ? `- Published: ${post.published_at}` : false,
    post.reading_time_minutes
      ? `- Reading time: ${post.reading_time_minutes} minutes`
      : false,
    post.tags && post.tags.length > 0
      ? `- Tags: ${post.tags.join(', ')}`
      : false,
    `- Canonical blog URL: ${origin}/blog/${post.slug}`,
    `- Markdown mirror: ${origin}/blog/${post.slug}.md`,
    '',
  ]);
}
