import { toHtml } from 'hast-util-to-html';
import { common, createLowlight } from 'lowlight';
import type React from 'react';
import { SafeHtml } from '@/components/ui/safe-html';
import { extractNodeText, type TipTapNode } from './blog-tiptap-node';

const lowlight = createLowlight(common);

export interface BlogCodeBlockRendererProps {
  node: TipTapNode;
  children: React.ReactNode;
}

/** Renders a TipTap codeBlock node with lowlight syntax highlighting. */
export const BlogCodeBlockRenderer = ({
  node,
  children,
}: BlogCodeBlockRendererProps) => {
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
      <SafeHtml
        as="code"
        className={language ? `language-${language}` : undefined}
        html={highlightedHtml}
      />
    </pre>
  ) : (
    <pre className="bg-slate-950 text-slate-50 p-6 rounded-xl font-mono text-sm overflow-x-auto my-8">
      <code>{children}</code>
    </pre>
  );
};
