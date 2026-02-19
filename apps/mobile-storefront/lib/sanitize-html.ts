import sanitizeLib from 'sanitize-html';

/**
 * Sanitize HTML content for safe rendering in React Native WebViews.
 * Uses sanitize-html (whitelist-based) to prevent XSS attacks.
 *
 * Strips: script, iframe, object, embed, form, input tags,
 * event handlers (on*), and javascript:/data: URIs.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return sanitizeLib(html, {
    allowedTags: [
      // Text formatting
      'b',
      'i',
      'em',
      'strong',
      'u',
      's',
      'mark',
      'small',
      'sub',
      'sup',
      // Headings
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      // Structure
      'p',
      'br',
      'hr',
      'div',
      'span',
      'blockquote',
      'pre',
      'code',
      // Lists
      'ul',
      'ol',
      'li',
      // Links and media
      'a',
      'img',
      // Tables
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      // Misc safe elements
      'button',
      'label',
      'select',
      'option',
      'textarea',
      'details',
      'summary',
      'figure',
      'figcaption',
      'video',
      'audio',
      'source',
      'picture',
    ],
    allowedAttributes: {
      '*': ['class', 'id', 'title', 'style', 'width', 'height'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      video: ['src', 'controls', 'poster', 'width', 'height'],
      audio: ['src', 'controls'],
      source: ['src', 'type'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    transformTags: {
      a: sanitizeLib.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}
