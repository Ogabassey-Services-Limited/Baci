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

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown };
  const ownText = typeof node.text === 'string' ? `${node.text} ` : '';
  const children = Array.isArray(node.content)
    ? node.content.map(collectJsonText).join('')
    : '';
  return `${ownText}${children}`.trim();
}
