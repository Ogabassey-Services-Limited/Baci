import { escapeHtmlText } from '@/lib/sanitize';
import { escapeHtmlAttr } from './blog-html-attribute-utils';

const DEFAULT_BLOG_IMAGE_ALT = 'Blog image';

const STANDALONE_IMAGE_BOUNDARY_TAGS = new Set(
  'article aside blockquote body dd details div dt figure footer h1 h2 h3 h4 h5 h6 header img li main nav ol p section ul'.split(
    ' '
  )
);
const HTML_TAG_AT_END_REGEX = /<\s*\/?\s*([a-z][a-z0-9-]*)\b[^>]*>\s*$/i;
const HTML_TAG_AT_START_REGEX = /^\s*<\s*\/?\s*([a-z][a-z0-9-]*)\b[^>]*>/i;
const HTML_TEXT_UNESCAPE_REGEX =
  /&(?:amp|lt|gt|quot|apos|#39|nbsp|copy|reg|trade|mdash|ndash|hellip|lsquo|rsquo|ldquo|rdquo|#\d+|#x[\da-f]+);/gi;
const HTML_TEXT_UNESCAPE_ENTITIES =
  "&amp;=&|&lt;=<|&gt;=>|&quot;=\"|&apos;='|&#39;='|&nbsp;=\u00a0|&copy;=\u00a9|&reg;=\u00ae|&trade;=\u2122|&mdash;=\u2014|&ndash;=\u2013|&hellip;=\u2026|&lsquo;=\u2018|&rsquo;=\u2019|&ldquo;=\u201c|&rdquo;=\u201d";
const HTML_TEXT_UNESCAPE_MAP: Record<string, string> = Object.fromEntries(
  HTML_TEXT_UNESCAPE_ENTITIES.split('|').map((entry) => {
    const separatorIndex = entry.indexOf('=');
    return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)];
  })
);

export function unescapeHtmlText(value: string): string {
  if (!value) return '';
  return value.replace(HTML_TEXT_UNESCAPE_REGEX, (match) => {
    const normalizedMatch = match.toLowerCase();
    const mapped = HTML_TEXT_UNESCAPE_MAP[normalizedMatch];
    if (mapped !== undefined) {
      return mapped;
    }

    if (normalizedMatch.startsWith('&#x')) {
      const codePoint = Number.parseInt(normalizedMatch.slice(3, -1), 16);
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }

    if (normalizedMatch.startsWith('&#')) {
      const codePoint = Number.parseInt(normalizedMatch.slice(2, -1), 10);
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }

    return match;
  });
}

function deriveAltFromImageSrc(src: string): string {
  const source = src.trim();
  if (!source) {
    return '';
  }

  let parsedPath = source;
  try {
    parsedPath = decodeURIComponent(new URL(source).pathname);
  } catch {
    parsedPath = source;
  }

  const fileName = parsedPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .pop();
  return fileName
    ? fileName
        .replace(/\.[a-z0-9]{2,8}$/i, '')
        .replace(/[-_](\d{2,5}x\d{2,5})$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

export function ensureBlogImageAltText(
  html: string,
  fallbackAltText: string | null | undefined
): string {
  const fallbackText = fallbackAltText?.trim() || DEFAULT_BLOG_IMAGE_ALT;
  const fallback = fallbackText.slice(0, 200);

  return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/\bsrc\s*=\s*(['"])(.*?)\1/i);
    const derivedAlt = deriveAltFromImageSrc(srcMatch?.[2] ?? '');
    const altCandidate = (derivedAlt || fallback).slice(0, 200).trim();
    const escapedAlt = escapeHtmlAttr(altCandidate);
    const altAttrRegex = /\balt\s*=\s*(['"])(.*?)\1/i;
    const currentAltMatch = imgTag.match(altAttrRegex);
    const currentAlt = currentAltMatch?.[2];

    if (currentAlt !== undefined) {
      return imgTag;
    }

    if (/\/\s*>$/.test(imgTag)) {
      return imgTag.replace(/\/\s*>$/, ` alt="${escapedAlt}" />`);
    }

    return imgTag.replace(/>$/, ` alt="${escapedAlt}">`);
  });
}

function formatFigureAttributes(attributes: string | undefined): string {
  const trimmedAttributes = attributes?.trim();
  return trimmedAttributes ? ` ${trimmedAttributes}` : '';
}

function buildFigureFromTitledImage(
  imgTag: string,
  figureAttributes?: string
): string | null {
  const titleMatch = imgTag.match(/\btitle\s*=\s*(['"])(.*?)\1/i);
  const rawTitle = titleMatch?.[2] ?? '';
  const trimmedTitle = rawTitle.trim();
  if (!trimmedTitle) return null;

  const captionText = escapeHtmlText(unescapeHtmlText(trimmedTitle));
  const imageWithoutTitle = imgTag.replace(/\s*title\s*=\s*(['"]).*?\1/i, '');

  return `<figure${formatFigureAttributes(figureAttributes)}>${imageWithoutTitle}<figcaption>${captionText}</figcaption></figure>`;
}

function isStandaloneImageBoundaryTag(tagName: string | undefined): boolean {
  return !!tagName && STANDALONE_IMAGE_BOUNDARY_TAGS.has(tagName.toLowerCase());
}

function hasStandaloneImageBoundaryBefore(
  html: string,
  index: number
): boolean {
  const before = html.slice(0, index).trimEnd();
  if (!before) {
    return true;
  }

  return isStandaloneImageBoundaryTag(before.match(HTML_TAG_AT_END_REGEX)?.[1]);
}

function hasStandaloneImageBoundaryAfter(html: string, index: number): boolean {
  const after = html.slice(index).trimStart();
  if (!after) {
    return true;
  }

  return isStandaloneImageBoundaryTag(
    after.match(HTML_TAG_AT_START_REGEX)?.[1]
  );
}

function isStandaloneImageBlock(
  html: string,
  imageStart: number,
  imageLength: number
): boolean {
  return (
    hasStandaloneImageBoundaryBefore(html, imageStart) &&
    hasStandaloneImageBoundaryAfter(html, imageStart + imageLength)
  );
}

export function transformImageTitlesToFigureCaptions(html: string): string {
  const withStandaloneFigures = html.replace(
    /<figure\b([^>]*)>\s*(<img\b[^<>]*>)\s*<\/figure>/gi,
    (figure, figureAttributes, imgTag) => {
      return buildFigureFromTitledImage(imgTag, figureAttributes) ?? figure;
    }
  );

  const withStandaloneImageParagraphs = withStandaloneFigures.replace(
    /<p\b([^>]*)>\s*(<img\b[^<>]*>)\s*<\/p>/gi,
    (paragraph, paragraphAttributes, imgTag) => {
      return (
        buildFigureFromTitledImage(imgTag, paragraphAttributes) ?? paragraph
      );
    }
  );

  return withStandaloneImageParagraphs.replace(
    /(<p\b[^>]*>[\s\S]*?<\/p>)|(<img\b[^<>]*>)/gi,
    (match, paragraph, imgTag, offset, fullHtml) => {
      if (paragraph) {
        return paragraph;
      }

      if (!imgTag) {
        return match;
      }

      if (!isStandaloneImageBlock(fullHtml, offset, imgTag.length)) {
        return match;
      }

      return buildFigureFromTitledImage(imgTag) ?? match;
    }
  );
}
