/** Shared TipTap node shapes for the blog renderer modules. */
export interface TipTapNode {
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: TipTap library
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  // biome-ignore lint/suspicious/noExplicitAny: TipTap library
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  text?: string;
}

export interface DeadContentLinkSets {
  blog: ReadonlySet<string>;
  products: ReadonlySet<string>;
}

export interface PriorityInlineImage {
  src: string;
  nodePath: string;
}

/** Recursively extract plain text from a TipTap node tree. */
export function extractNodeText(node: TipTapNode): string {
  if (node.text) return node.text;
  return node.content?.map(extractNodeText).join('') || '';
}
