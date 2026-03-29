import type { HTMLAttributes } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

type SafeHtmlProps = {
  html: string;
  headingLevelOffset?: number;
} & Omit<
  HTMLAttributes<HTMLDivElement>,
  'dangerouslySetInnerHTML' | 'children'
>;

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
export function SafeHtml({ html, headingLevelOffset, ...rest }: SafeHtmlProps) {
  if (!html) {
    return <div {...rest} />;
  }
  return (
    <div
      {...rest}
      // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Content sanitized via sanitizeHtml() allowlist — this is the ONLY place dangerouslySetInnerHTML should be used for HTML content
      dangerouslySetInnerHTML={{
        __html: sanitizeHtml(html, { headingLevelOffset }),
      }}
    />
  );
}
