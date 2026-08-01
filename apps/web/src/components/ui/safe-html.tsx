import { createElement, type HTMLAttributes } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import type { SanitizeHtmlOptions } from '@/lib/sanitize-html-config';

type SafeHtmlTag = 'code' | 'div' | 'span';

type SafeHtmlProps = {
  as?: SafeHtmlTag;
  html: string;
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
 */
export function SafeHtml({
  as = 'div',
  html,
  headingLevelOffset,
  forceLazyImages,
  normalizeHeadingHierarchy,
  normalizeSeoAnchors,
  stripNofollowFromLinks,
  trustedPriorityImageSources,
  ...rest
}: SafeHtmlProps) {
  if (!html) {
    return createElement(as, rest);
  }

  const headingOptions: SanitizeHtmlOptions = normalizeHeadingHierarchy
    ? { normalizeHeadingHierarchy: true }
    : { headingLevelOffset };

  return createElement(as, {
    ...rest,
    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
    // react-doctor-disable-next-line react-doctor/no-danger -- Central allowlist sanitizer boundary; callers must use SafeHtml instead of raw dangerouslySetInnerHTML.
    dangerouslySetInnerHTML: {
      __html: sanitizeHtml(html, {
        ...headingOptions,
        forceLazyImages,
        normalizeSeoAnchors,
        stripNofollowFromLinks,
        trustedPriorityImageSources,
      }),
    },
  });
}
