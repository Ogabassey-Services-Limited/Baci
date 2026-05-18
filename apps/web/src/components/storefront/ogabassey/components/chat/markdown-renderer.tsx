import type React from 'react';

/** Allowed URL protocols for security (blocks javascript:, data:, vbscript:, etc.) */
const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const;

/**
 * Sanitizes a URL for safe usage in href/src attributes.
 * Returns the sanitized URL or null if unsafe.
 *
 * Security: Prevents XSS via javascript:, data:, vbscript: and other dangerous protocols.
 * Only allows http:, https:, and mailto: URLs.
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://dummy.com');
    if (!SAFE_URL_PROTOCOLS.includes(parsed.protocol as (typeof SAFE_URL_PROTOCOLS)[number])) {
      return null;
    }
    if (parsed.protocol === 'mailto:') {
      return url;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Enhanced markdown renderer for chat messages.
 * Supports: **bold**, *list items, [links](url), ![images](url), and line breaks.
 *
 * Security measures (XSS prevention):
 * - All text content is rendered via React JSX, which automatically escapes HTML entities
 * - URLs are validated via sanitizeUrl() which only allows http:, https:, mailto: protocols
 * - No innerHTML, dangerouslySetInnerHTML, or direct DOM manipulation is used
 * - All attribute values are escaped by React's rendering engine
 */
export function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    const isListItem = /^\s*[*-]\s+/.test(line);
    const cleanLine = isListItem ? line.replace(/^\s*[*-]\s+/, '') : line;

    const parseInline = (content: string): React.ReactNode[] => {
      const elements: React.ReactNode[] = [];
      let remaining = content;
      let keyIndex = 0;
      const maxIterations = 1000;
      let iterations = 0;

      while (remaining.length > 0 && iterations < maxIterations) {
        iterations++;

        // Check for image: ![alt](url)
        const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch) {
          const safeSrc = sanitizeUrl(imgMatch[2]);
          const altText = imgMatch[1] || 'Image';
          if (safeSrc) {
            elements.push(
              <img
                key={`${lineIndex}-img-${keyIndex++}`}
                src={safeSrc}
                alt={altText}
                className="max-w-full max-h-64 object-contain rounded-lg my-2 shadow-sm border border-gray-100"
                loading="lazy"
              />
            );
          }
          remaining = remaining.slice(imgMatch[0].length);
          continue;
        }

        // Check for link: [text](url)
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const safeHref = sanitizeUrl(linkMatch[2]);
          const linkText = linkMatch[1];
          if (safeHref) {
            elements.push(
              <a
                key={`${lineIndex}-link-${keyIndex++}`}
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 underline hover:text-red-700 font-medium"
              >
                {linkText}
              </a>
            );
          } else {
            elements.push(linkText);
          }
          remaining = remaining.slice(linkMatch[0].length);
          continue;
        }

        // Check for bold: **text**
        const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
        if (boldMatch) {
          elements.push(
            <strong key={`${lineIndex}-bold-${keyIndex++}`} className="font-semibold">
              {boldMatch[1]}
            </strong>
          );
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Find next special pattern
        const nextPattern = remaining.search(/!\[|\[|\*\*/);
        if (nextPattern === -1) {
          if (remaining) elements.push(remaining);
          break;
        }
        if (nextPattern > 0) {
          elements.push(remaining.slice(0, nextPattern));
          remaining = remaining.slice(nextPattern);
        } else {
          elements.push(remaining[0]);
          remaining = remaining.slice(1);
        }
      }

      return elements;
    };

    const renderedParts = parseInline(cleanLine);

    if (isListItem) {
      return (
        <div key={lineIndex} className="flex items-start gap-2 my-1">
          <span className="text-red-600 mt-0.5 shrink-0">&bull;</span>
          <span className="flex-1">{renderedParts}</span>
        </div>
      );
    }

    if (!cleanLine.trim()) {
      return <div key={lineIndex} className="h-2" />;
    }

    return <div key={lineIndex}>{renderedParts}</div>;
  });
}
