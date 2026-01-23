'use client';

import DOMPurify from 'isomorphic-dompurify';
import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { cn } from '@/lib/utils';

/**
 * Premium 2026 JSON-to-React Renderer for Baci
 * This component recursively renders TipTap JSON as native React components.
 */

interface TipTapNode {
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: TipTap node types from external library
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  // biome-ignore lint/suspicious/noExplicitAny: TipTap node types from external library
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  text?: string;
}

interface NodeRendererProps {
  node: TipTapNode;
  _index?: number;
}

const TextRenderer = ({ node }: { node: TipTapNode }) => {
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
        case 'link':
          content = (
            <Link
              key={mark.type}
              href={mark.attrs?.href || '#'}
              target={mark.attrs?.target || '_blank'}
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 decoration-primary/30 hover:text-primary/80"
            >
              {content}
            </Link>
          );
          break;
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

const NodeRenderer = ({ node, _index }: NodeRendererProps): React.ReactNode => {
  const children = node.content?.map((child, i) => (
    <NodeRenderer key={`${child.type}-${i}`} node={child} _index={i} />
  ));

  const textAlignClass = node.attrs?.textAlign
    ? `text-${node.attrs.textAlign}`
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

      return <Tag className={cn(sizeClasses, textAlignClass)}>{children}</Tag>;
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

    case 'image':
      return (
        <div className="relative aspect-video rounded-2xl overflow-hidden my-10 shadow-xl border border-border/50">
          <Image
            src={node.attrs?.src}
            alt={node.attrs?.alt || 'Blog image'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
      );

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

    case 'codeBlock':
      return (
        <pre className="bg-slate-950 text-slate-50 p-6 rounded-xl font-mono text-sm overflow-x-auto my-8">
          <code>{children}</code>
        </pre>
      );

    case 'horizontalRule':
      return <hr className="my-12 border-t border-border" />;

    case 'text':
      return <TextRenderer node={node} />;

    case 'hardBreak':
      return <br />;

    default:
      console.warn(`Unknown node type: ${node.type}`);
      return null;
  }
};

// biome-ignore lint/suspicious/noExplicitAny: TipTap node types from external library
export const BlogContentRenderer = ({ json }: { json: any }) => {
  if (!json) return null;

  try {
    const doc = typeof json === 'string' ? JSON.parse(json) : json;

    // Safety check for TipTap format
    if (doc.type !== 'doc') {
      return (
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Fallback for non-TipTap HTML
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              typeof json === 'string' ? json : String(json)
            ),
          }}
        />
      );
    }

    return (
      <div className="blog-content-renderer prose dark:prose-invert prose-baci max-w-none text-foreground">
        <NodeRenderer node={doc} _index={0} />
      </div>
    );
  } catch (e) {
    console.error('Renderer failed:', e);
    return (
      <div
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Error recovery fallback
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(
            typeof json === 'string' ? json : String(json)
          ),
        }}
      />
    );
  }
};
