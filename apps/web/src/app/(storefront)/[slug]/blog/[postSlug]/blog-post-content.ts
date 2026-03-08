import { marked } from 'marked';
import { stripHtml } from '@/lib/blog-utils';
import { sanitizeHtml } from '@/lib/sanitize';

interface TipTapNode {
  content?: TipTapNode[];
  text?: string;
  type?: string;
}

function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/') {
    return '';
  }

  return basePath.replace(/\/+$/, '');
}

function tryParseJson(content: unknown): unknown | null {
  if (typeof content !== 'string') {
    return content ?? null;
  }

  try {
    return JSON.parse(content.trim());
  } catch {
    return null;
  }
}

function extractTipTapText(node: TipTapNode): string {
  const childText = node.content?.map(extractTipTapText).join(' ') || '';
  return [node.text, childText].filter(Boolean).join(' ').trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export async function resolveBlogPostContent(content: unknown) {
  const contentStr =
    typeof content === 'string' ? content : JSON.stringify(content ?? '');
  const trimmedContent = contentStr.trim();
  const parsedJson = tryParseJson(content);
  const renderedContent =
    parsedJson !== null && typeof parsedJson === 'object'
      ? parsedJson
      : content;
  const isJson =
    renderedContent !== null && typeof renderedContent === 'object';
  const isHtml = trimmedContent.startsWith('<');

  let legacyHtml = '';
  if (!isJson) {
    legacyHtml = sanitizeHtml(
      isHtml ? contentStr : await marked(contentStr || '')
    );
  }

  return {
    contentStr,
    isJson,
    legacyHtml,
    renderedContent,
  };
}

export function getBlogPostTextPreview(
  content: unknown,
  maxLength = 160,
  fallback = 'Read this blog post'
): string {
  const parsedJson = tryParseJson(content);

  if (parsedJson && typeof parsedJson === 'object') {
    if ('type' in parsedJson && (parsedJson as TipTapNode).type === 'doc') {
      const text = extractTipTapText(parsedJson as TipTapNode)
        .replace(/\s+/g, ' ')
        .trim();

      return text ? truncateText(text, maxLength) : fallback;
    }

    return fallback;
  }

  if (typeof content === 'string') {
    const text = stripHtml(content).replace(/\s+/g, ' ').trim();
    return text ? truncateText(text, maxLength) : fallback;
  }

  return fallback;
}

export function buildBlogUrl(
  baseUrl: string,
  basePath: string,
  postSlug?: string
): string {
  const blogUrl = `${baseUrl}${normalizeBasePath(basePath)}/blog`;
  return postSlug ? `${blogUrl}/${postSlug}` : blogUrl;
}
