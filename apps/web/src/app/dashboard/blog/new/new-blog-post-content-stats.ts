function getTextContent(jsonString: string): string {
  try {
    if (!jsonString) return '';
    if (jsonString.trim().startsWith('<') && typeof window !== 'undefined') {
      const parser = new DOMParser();
      const document = parser.parseFromString(jsonString, 'text/html');
      return document.body.textContent || '';
    }
    const traverse = (node: { content?: unknown; text?: unknown }): string => {
      const text = typeof node.text === 'string' ? `${node.text} ` : '';
      if (!Array.isArray(node.content)) return text;
      return `${text}${node.content
        .filter((child): child is { content?: unknown; text?: unknown } =>
          Boolean(child && typeof child === 'object')
        )
        .map(traverse)
        .join('')}`;
    };
    return traverse(
      JSON.parse(jsonString) as { content?: unknown; text?: unknown }
    ).trim();
  } catch {
    return '';
  }
}

export function getNewBlogPostContentStats(content: string) {
  const wordCount = getTextContent(content).split(/\s+/).filter(Boolean).length;
  return { wordCount, readingTime: Math.ceil(wordCount / 200) };
}
