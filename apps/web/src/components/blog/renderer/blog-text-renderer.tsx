import type React from 'react';
import { sanitizeUrl } from '@/lib/sanitize-core';
import type { StorefrontContentLinkRewrites } from '@/lib/storefront-content-link-rewriting';
import { normalizeStorefrontContentHref } from '@/lib/storefront-link-normalization';
import type { DeadContentLinkSets, TipTapNode } from './blog-tiptap-node';
import { resolveRenderedInternalLink } from './resolve-rendered-internal-link';

function isTechnicalResourceHref(href: string): boolean {
  const normalizedHref = href.trim().toLowerCase();
  if (!normalizedHref) {
    return false;
  }

  try {
    const { pathname } = new URL(normalizedHref, 'https://example.invalid');
    if (pathname === '/_next/image') {
      return true;
    }
    return /\.(?:js|json)(?:$|[?#])/i.test(pathname);
  } catch {
    return /\.(?:js|json)(?:$|[?#])/i.test(normalizedHref);
  }
}

export interface BlogTextRendererProps {
  node: TipTapNode;
  basePath?: string;
  baseUrl?: string;
  contentLinkRewrites?: StorefrontContentLinkRewrites;
  deadContentLinkSets?: DeadContentLinkSets;
  merchantSlug?: string;
}

/**
 * Renders a TipTap text node with its marks (bold, italic, link, ...).
 * Internal links are normalized, canonically rewritten when redirectable,
 * and unwrapped to plain text when their target is known dead.
 */
export const BlogTextRenderer = ({
  node,
  basePath,
  baseUrl,
  contentLinkRewrites,
  deadContentLinkSets,
  merchantSlug,
}: BlogTextRendererProps) => {
  if (!node.text) return null;

  let content: React.ReactNode = node.text;

  // Apply Marks (Bold, Italic, Link, etc.)
  if (node.marks) {
    for (const mark of node.marks) {
      switch (mark.type) {
        case 'bold':
          content = <strong key={mark.type}>{content}</strong>;
          break;
        case 'italic':
          content = <em key={mark.type}>{content}</em>;
          break;
        case 'underline':
          content = <u key={mark.type}>{content}</u>;
          break;
        case 'strike':
          content = <s key={mark.type}>{content}</s>;
          break;
        case 'code':
          content = (
            <code
              key={mark.type}
              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
            >
              {content}
            </code>
          );
          break;
        case 'link': {
          // 2026 Security Best Practice: Sanitize URLs but allow safe relative/anchor links
          const rawHref =
            typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
          const normalizedHref = normalizeStorefrontContentHref(rawHref, {
            basePath,
            baseUrl,
            merchantSlug,
          });
          if (
            isTechnicalResourceHref(rawHref) ||
            isTechnicalResourceHref(normalizedHref)
          ) {
            content = <span key={mark.type}>{content}</span>;
            break;
          }

          const isRelative =
            normalizedHref.startsWith('/') && !normalizedHref.startsWith('//');
          const isAnchor = normalizedHref.startsWith('#');

          const { href: resolvedHref, isDead: isDeadInternal } =
            resolveRenderedInternalLink(normalizedHref, {
              basePath,
              contentLinkRewrites,
              deadBlogSlugs: deadContentLinkSets?.blog,
              deadProductSlugs: deadContentLinkSets?.products,
            });

          const safeHref =
            isRelative || isAnchor ? resolvedHref : sanitizeUrl(resolvedHref);

          const isExternal =
            !!safeHref && !isRelative && !isAnchor && !safeHref.startsWith('/');

          content =
            safeHref && !isDeadInternal ? (
              // Use anchor tag for user-generated URLs
              <a
                key={mark.type}
                href={safeHref}
                target={isExternal ? mark.attrs?.target || '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-primary underline underline-offset-4 decoration-primary/30 hover:text-primary/80"
              >
                {content}
              </a>
            ) : (
              // Render as plain text if URL is invalid/malicious (e.g. "javascript:")
              <span key={mark.type}>{content}</span>
            );
          break;
        }
        case 'textStyle':
          if (mark.attrs?.color) {
            content = (
              <span key={mark.type} style={{ color: mark.attrs.color }}>
                {content}
              </span>
            );
          }
          break;
      }
    }
  }

  return <>{content}</>;
};
