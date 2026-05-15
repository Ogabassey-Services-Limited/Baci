'use client';

import { toHtml } from 'hast-util-to-html';
import { common, createLowlight } from 'lowlight';
import Image from 'next/image';
import type React from 'react';
import { SafeHtml } from '@/components/ui/safe-html';
import { generateHeadingId } from '@/lib/blog-utils';
import { sanitizeUrl } from '@/lib/sanitize-core';
import { normalizeStorefrontContentHref } from '@/lib/storefront-link-normalization';
import { cn } from '@/lib/utils';

const lowlight = createLowlight(common);

// Explicit text alignment class mapping for Tailwind tree-shaking (2026 best practice)
const TEXT_ALIGN_CLASSES: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

/**
 * Premium 2026 JSON-to-React Renderer for Baci
 * This component recursively renders TipTap JSON as native React components.
 */

interface TipTapNode {
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: TipTap library
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  // biome-ignore lint/suspicious/noExplicitAny: TipTap library
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  text?: string;
}

interface NodeRendererProps {
  basePath?: string;
  baseUrl?: string;
  merchantSlug?: string;
  node: TipTapNode;
  index: number;
}

interface BlogContentRendererProps {
  basePath?: string;
  baseUrl?: string;
  // biome-ignore lint/suspicious/noExplicitAny: TipTap library returns any type
  json: any;
  merchantSlug?: string;
}

const TextRenderer = ({
  node,
  basePath,
  baseUrl,
  merchantSlug,
}: {
  node: TipTapNode;
  basePath?: string;
  baseUrl?: string;
  merchantSlug?: string;
}) => {
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
          const rawHref = mark.attrs?.href ?? '';
          const normalizedHref = normalizeStorefrontContentHref(rawHref, {
            basePath,
            baseUrl,
            merchantSlug,
          });
          const isRelative =
            normalizedHref.startsWith('/') && !normalizedHref.startsWith('//');
          const isAnchor = normalizedHref.startsWith('#');

          const safeHref =
            isRelative || isAnchor
              ? normalizedHref
              : sanitizeUrl(normalizedHref);

          const isExternal =
            !!safeHref && !isRelative && !isAnchor && !safeHref.startsWith('/');

          content = safeHref ? (
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

/** Recursively extract plain text from a TipTap node tree. */
function extractNodeText(node: TipTapNode): string {
  if (node.text) return node.text;
  return node.content?.map(extractNodeText).join('') || '';
}

const NodeRenderer = ({
  basePath,
  baseUrl,
  merchantSlug,
  node,
  index: _index,
}: NodeRendererProps): React.ReactNode => {
  const children = node.content?.map((child, i) => (
    <NodeRenderer
      // biome-ignore lint/suspicious/noArrayIndexKey: TipTap sibling nodes do not expose stable ids; document order defines render identity.
      key={`${child.type}-${i}`}
      basePath={basePath}
      baseUrl={baseUrl}
      merchantSlug={merchantSlug}
      node={child}
      index={i}
    />
  ));

  // Use explicit mapping for Tailwind tree-shaking (avoids dynamic class generation)
  const textAlignClass = node.attrs?.textAlign
    ? TEXT_ALIGN_CLASSES[node.attrs.textAlign] || ''
    : '';

  switch (node.type) {
    case 'doc':
      return <div className="space-y-4">{children}</div>;

    case 'paragraph':
      // Safety: Empty paragraphs should render a break or space
      if (!node.content || node.content.length === 0) return <br />;
      return (
        <p className={cn('leading-relaxed', textAlignClass)}>{children}</p>
      );

    case 'heading': {
      const level = node.attrs?.level || 1;
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      const sizeClasses =
        {
          1: 'text-4xl font-bold mt-12 mb-6',
          2: 'text-3xl font-bold mt-10 mb-5',
          3: 'text-2xl font-bold mt-8 mb-4',
          4: 'text-xl font-bold mt-6 mb-3',
        }[level as 1 | 2 | 3 | 4] || 'text-lg font-bold';

      const headingText = extractNodeText(node);
      const headingId = generateHeadingId(headingText);

      return (
        <Tag
          id={headingId}
          className={cn(sizeClasses, textAlignClass, 'scroll-mt-20 group')}
        >
          {children}
          <a
            href={`#${headingId}`}
            className="ml-2 opacity-0 group-hover:opacity-50 transition-opacity text-muted-foreground"
            aria-label={`Link to ${headingText}`}
          >
            #
          </a>
        </Tag>
      );
    }

    case 'bulletList':
      return <ul className="list-disc pl-6 space-y-2 my-6">{children}</ul>;

    case 'orderedList':
      return <ol className="list-decimal pl-6 space-y-2 my-6">{children}</ol>;

    case 'listItem':
      return <li className="leading-relaxed">{children}</li>;

    case 'blockquote':
      return (
        <blockquote className="border-l-4 border-primary/40 bg-muted/30 px-6 py-4 italic rounded-r-lg my-8">
          {children}
        </blockquote>
      );

    case 'image': {
      // Guard against missing src to prevent runtime errors
      const rawSrc = node.attrs?.src;
      const imageSrc = rawSrc ? sanitizeUrl(rawSrc) : '';
      const imageCaption =
        (typeof node.attrs?.title === 'string'
          ? node.attrs.title
          : ''
        ).trim() ||
        (typeof node.attrs?.caption === 'string'
          ? node.attrs.caption.trim()
          : '');

      // Only allow http/https protocols for blog images in 2026 for security and CDN stability
      if (!imageSrc?.startsWith('http')) {
        console.warn('Blog image node missing or invalid src attribute');
        return null;
      }

      const imageContainer = (
        <div
          className={cn(
            'relative aspect-video rounded-2xl overflow-hidden shadow-xl border border-border/50',
            !imageCaption && 'my-10'
          )}
        >
          <Image
            src={imageSrc}
            alt={node.attrs?.alt || 'Blog image'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
      );

      if (!imageCaption) {
        return imageContainer;
      }

      return (
        <figure className="my-10">
          {imageContainer}
          <figcaption className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
            {imageCaption}
          </figcaption>
        </figure>
      );
    }

    case 'table':
      return (
        <div className="overflow-x-auto my-8 border border-border rounded-xl">
          <table className="w-full border-collapse text-sm">
            <tbody>{children}</tbody>
          </table>
        </div>
      );

    case 'tableRow':
      return (
        <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
          {children}
        </tr>
      );

    case 'tableHeader':
      return (
        <th className="bg-muted/50 px-4 py-3 text-left font-semibold text-foreground border-r border-border/50">
          {children}
        </th>
      );

    case 'tableCell':
      return (
        <td className="px-4 py-3 border-r border-border/50 text-muted-foreground">
          {children}
        </td>
      );

    case 'codeBlock': {
      const language = node.attrs?.language || '';
      const codeText = extractNodeText(node);
      let highlightedHtml = '';
      try {
        const tree =
          language && lowlight.registered(language)
            ? lowlight.highlight(language, codeText)
            : lowlight.highlightAuto(codeText);
        highlightedHtml = toHtml(tree);
      } catch {
        // Fallback to plain text if highlighting fails
      }

      return highlightedHtml ? (
        <pre className="bg-slate-950 text-slate-50 p-6 rounded-xl font-mono text-sm overflow-x-auto my-8">
          <code
            className={language ? `language-${language}` : undefined}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Syntax-highlighted HTML from lowlight (trusted, no user input)
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      ) : (
        <pre className="bg-slate-950 text-slate-50 p-6 rounded-xl font-mono text-sm overflow-x-auto my-8">
          <code>{children}</code>
        </pre>
      );
    }

    case 'horizontalRule':
      return <hr className="my-12 border-t border-border" />;

    case 'text':
      return (
        <TextRenderer
          node={node}
          basePath={basePath}
          baseUrl={baseUrl}
          merchantSlug={merchantSlug}
        />
      );

    case 'hardBreak':
      return <br />;

    default:
      console.warn(`Unknown node type: ${node.type}`);
      return null;
  }
};

export const BlogContentRenderer = ({
  json,
  basePath,
  baseUrl,
  merchantSlug,
}: BlogContentRendererProps) => {
  if (!json) return null;

  try {
    const doc = typeof json === 'string' ? JSON.parse(json) : json;

    // Safety check for TipTap format
    if (doc.type !== 'doc') {
      return <SafeHtml html={typeof json === 'string' ? json : ''} />;
    }

    return (
      <div className="blog-content-renderer prose dark:prose-invert prose-baci max-w-none text-foreground">
        <NodeRenderer
          basePath={basePath}
          baseUrl={baseUrl}
          merchantSlug={merchantSlug}
          node={doc}
          index={0}
        />
      </div>
    );
  } catch (e) {
    console.error('Renderer failed:', e);
    return <SafeHtml html={typeof json === 'string' ? json : ''} />;
  }
};
