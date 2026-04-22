import { marked } from 'marked';
import { stripHtml } from '@/lib/blog-utils';
import { sanitizeHtml } from '@/lib/sanitize';
import { escapeHtml } from '@/lib/sanitize-core';
import { buildStoreUrl } from '@/lib/store-url';
import { rewriteHtmlStorefrontHrefs } from '@/lib/storefront-html-link-rewriting';
import type { NormalizeStorefrontContentHrefOptions } from '@/lib/storefront-link-normalization';

interface TipTapNode {
  content?: TipTapNode[];
  text?: string;
  type?: string;
}

const MAX_TIPTAP_DEPTH = 75;
const DEFAULT_BLOG_IMAGE_ALT = 'Blog image';

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

function extractTipTapText(
  node: TipTapNode,
  depth = 0,
  maxDepth = MAX_TIPTAP_DEPTH
): string {
  if (depth >= maxDepth) {
    return node.text?.trim() || '';
  }

  const childText =
    node.content
      ?.map((childNode) => extractTipTapText(childNode, depth + 1, maxDepth))
      .join(' ') || '';
  return [node.text, childText].filter(Boolean).join(' ').trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function deriveAltFromImageSrc(src: string): string {
  if (!src) {
    return '';
  }

  const source = src.trim();
  if (!source) {
    return '';
  }

  const parsedPath = (() => {
    try {
      return decodeURIComponent(new URL(source).pathname);
    } catch {
      return source;
    }
  })();

  const fileName = parsedPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .pop();
  if (!fileName) {
    return '';
  }

  const cleaned = fileName
    .replace(/\.[a-z0-9]{2,8}$/i, '')
    .replace(/[-_](\d{2,5}x\d{2,5})$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function ensureBlogImageAltText(
  html: string,
  fallbackAltText: string | null | undefined
): string {
  const fallback = (fallbackAltText?.trim() || DEFAULT_BLOG_IMAGE_ALT).slice(
    0,
    200
  );

  return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/\bsrc\s*=\s*(['"])(.*?)\1/i);
    const derivedAlt = deriveAltFromImageSrc(srcMatch?.[2] ?? '');
    const altCandidate = (derivedAlt || fallback).slice(0, 200).trim();
    const escapedAlt = escapeHtml(altCandidate).replace(/"/g, '&quot;');
    const altAttrRegex = /\balt\s*=\s*(['"])(.*?)\1/i;
    const currentAltMatch = imgTag.match(altAttrRegex);
    const currentAlt = currentAltMatch?.[2]?.trim() || '';

    if (currentAlt.length > 0) {
      return imgTag;
    }

    if (currentAltMatch) {
      return imgTag.replace(altAttrRegex, `alt="${escapedAlt}"`);
    }

    if (/\/\s*>$/.test(imgTag)) {
      return imgTag.replace(/\/\s*>$/, ` alt="${escapedAlt}" />`);
    }

    return imgTag.replace(/>$/, ` alt="${escapedAlt}">`);
  });
}

type ResolveBlogPostContentOptions = NormalizeStorefrontContentHrefOptions & {
  fallbackImageAlt?: string | null;
};

export async function resolveBlogPostContent(
  content: unknown,
  options: ResolveBlogPostContentOptions = {}
) {
  const contentStr =
    typeof content === 'string'
      ? content
      : content && typeof content === 'object'
        ? JSON.stringify(content)
        : '';
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
    const rawHtml = isHtml ? contentStr : await marked(contentStr || '');
    const rewrittenHtml = rewriteHtmlStorefrontHrefs(rawHtml, options);
    const sanitizedHtml = sanitizeHtml(rewrittenHtml);
    legacyHtml = ensureBlogImageAltText(
      sanitizedHtml,
      options.fallbackImageAlt
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

export function buildCanonicalBlogPostUrl(
  merchant: { slug: string; custom_domain?: string },
  postSlug: string
): string {
  return `${buildStoreUrl(merchant)}/blog/${postSlug}`;
}

export function buildBlogUrl(
  baseUrl: string,
  basePath: string,
  postSlug?: string
): string {
  const blogUrl = `${baseUrl}${normalizeBasePath(basePath)}/blog`;
  return postSlug ? `${blogUrl}/${postSlug}` : blogUrl;
}
