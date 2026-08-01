export function getBlogContentStats(content: string): {
  wordCount: number;
  readingTime: number;
} {
  try {
    if (!content) return { wordCount: 0, readingTime: 0 };
    const text =
      content.trim().startsWith('<') && typeof window !== 'undefined'
        ? new DOMParser().parseFromString(content, 'text/html').body
            .textContent || ''
        : collectJsonText(JSON.parse(content));
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return { wordCount, readingTime: Math.ceil(wordCount / 200) };
  } catch {
    return { wordCount: 0, readingTime: 0 };
  }
}

const BLOCK_NODE_TYPES = new Set([
  'blockquote',
  'bulletList',
  'codeBlock',
  'doc',
  'heading',
  'listItem',
  'orderedList',
  'paragraph',
  'table',
  'tableCell',
  'tableHeader',
  'tableRow',
]);

function isBlockNode(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && BLOCK_NODE_TYPES.has(type);
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'hardBreak') return ' ';
  if (!Array.isArray(node.content)) return '';
  const separator = node.content.some(isBlockNode) ? ' ' : '';
  return node.content.map(collectJsonText).join(separator).trim();
}
