import { createElement, type HTMLAttributes } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import type { SanitizeHtmlOptions } from '@/lib/sanitize-html-config';
import type { SanitizedHtml } from './sanitized-html';

type SafeHtmlTag = 'code' | 'div' | 'span';

type SafeHtmlProps = (
  | {
      html: string;
      sanitizedHtml?: never;
    }
  | {
      html?: never;
      sanitizedHtml: SanitizedHtml;
    }
) & {
  as?: SafeHtmlTag;
} & SanitizeHtmlOptions &
  Omit<HTMLAttributes<HTMLElement>, 'dangerouslySetInnerHTML' | 'children'>;

/**
 * Renders sanitized HTML content safely.
 *
 * Wraps the sanitize-html allowlist-based sanitizer so that no file
 * needs to use `dangerouslySetInnerHTML` directly. The sanitizer strips
 * all tags/attributes not on the allowlist (no `<script>`, `<iframe>`,
 * `onclick`, `javascript:` URIs, etc.).
 *
 * @example
 * ```tsx
 * <SafeHtml html={merchantAboutText} className="prose" />
 * <SafeHtml html={content} className="prose" data-testid="blog-body" />
 * ```
 *
 * Use `sanitizeForSafeHtml` when a server caller needs to inspect sanitized
 * markup before rendering it, then pass the branded result as `sanitizedHtml`
 * so this boundary does not parse the same content a second time.
 */
export function SafeHtml({
  as = 'div',
  html,
  sanitizedHtml,
  headingLevelOffset,
  forceLazyImages,
  normalizeHeadingHierarchy,
  normalizeSeoAnchors,
  stripNofollowFromLinks,
  trustedPriorityImageSources,
  ...rest
}: SafeHtmlProps) {
  const renderedHtml = sanitizedHtml ?? html ?? '';
  if (!renderedHtml) {
    return createElement(as, rest);
  }

  const headingOptions: SanitizeHtmlOptions = normalizeHeadingHierarchy
    ? { normalizeHeadingHierarchy: true }
    : { headingLevelOffset };
  const safeHtml =
    sanitizedHtml ??
    sanitizeHtml(html ?? '', {
      ...headingOptions,
      forceLazyImages,
      normalizeSeoAnchors,
      stripNofollowFromLinks,
      trustedPriorityImageSources,
    });

  return createElement(as, {
    ...rest,
    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
    // react-doctor-disable-next-line react-doctor/no-danger -- Central allowlist sanitizer boundary; callers must use SafeHtml instead of raw dangerouslySetInnerHTML.
    dangerouslySetInnerHTML: {
      __html: safeHtml,
    },
  });
}
