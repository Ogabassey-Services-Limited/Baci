function findBracketClose(
  content: string,
  start: number,
  boundary = content.length
): number {
  let depth = 0;
  for (let index = start; index < boundary; index += 1) {
    const character = content[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '[') depth += 1;
    else if (character === ']') {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function findAngleClose(
  content: string,
  start: number,
  boundary = content.length
): number {
  for (let index = start; index < boundary; index += 1) {
    if (content[index] === '\\') {
      index += 1;
      continue;
    }
    if (content[index] === '>') return index;
  }
  return -1;
}

function normalizeMarkdownReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function isEscaped(content: string, index: number): boolean {
  let backslashCount = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && content[cursor] === '\\';
    cursor -= 1
  )
    backslashCount += 1;
  return backslashCount % 2 === 1;
}

function findNextImageToken(
  content: string,
  start: number,
  boundary = content.length
): number {
  let cursor = content.indexOf('![', start);
  while (cursor !== -1 && cursor < boundary) {
    if (!isEscaped(content, cursor)) return cursor;
    cursor = content.indexOf('![', cursor + 2);
  }
  return -1;
}

/** Scans inline Markdown links and tracks which reference labels are images. */
export function scanMarkdownLinkSyntax(content: string): {
  destinations: ReadonlyArray<{ destination: string; image: boolean }>;
  imageReferenceLabels: ReadonlySet<string>;
} {
  const destinations: { destination: string; image: boolean }[] = [];
  const imageReferenceLabels = new Set<string>();
  let index = 0;
  while (index < content.length) {
    const image =
      content[index] === '!' &&
      content[index + 1] === '[' &&
      !isEscaped(content, index);
    if (!image && content[index] !== '[') {
      index += 1;
      continue;
    }
    const openingBracket = image ? index + 1 : index;
    const closingBracket = findBracketClose(content, openingBracket + 1);
    if (closingBracket === -1) {
      const nextImage = findNextImageToken(content, openingBracket + 1);
      if (nextImage !== -1) {
        index = nextImage;
        continue;
      }
      break;
    }
    const label = content.slice(openingBracket + 1, closingBracket);
    const suffix = content[closingBracket + 1];
    if (image && suffix !== '(') {
      if (suffix === '[') {
        const referenceEnd = findBracketClose(content, closingBracket + 2);
        if (referenceEnd !== -1) {
          const explicitLabel = content.slice(closingBracket + 2, referenceEnd);
          imageReferenceLabels.add(
            normalizeMarkdownReferenceLabel(explicitLabel || label)
          );
          index = referenceEnd + 1;
          continue;
        }
      } else imageReferenceLabels.add(normalizeMarkdownReferenceLabel(label));
      index = closingBracket + 1;
      continue;
    }
    if (suffix !== '(') {
      const nestedImage = findNextImageToken(
        content,
        openingBracket + 1,
        closingBracket
      );
      if (nestedImage !== -1) {
        index = nestedImage;
        continue;
      }
      index = closingBracket + 1;
      continue;
    }
    if (!image) {
      const nestedSyntax = scanMarkdownLinkSyntax(label);
      destinations.push(...nestedSyntax.destinations);
      for (const referenceLabel of nestedSyntax.imageReferenceLabels)
        imageReferenceLabels.add(referenceLabel);
    }
    let cursor = closingBracket + 2;
    while (/\s/u.test(content[cursor] ?? '')) cursor += 1;
    const start = cursor;
    if (content[cursor] === '<') {
      const angleStart = ++cursor;
      const angleEnd = findAngleClose(content, cursor);
      if (angleEnd !== -1)
        destinations.push({
          destination: content.slice(angleStart, angleEnd),
          image,
        });
      index = angleEnd === -1 ? content.length : angleEnd + 1;
      continue;
    }
    let depth = 0;
    while (cursor < content.length) {
      const character = content[cursor] ?? '';
      if (character === '\\') {
        cursor += 2;
        continue;
      }
      if (character === '(') depth += 1;
      else if (character === ')') {
        if (depth === 0) break;
        depth -= 1;
      } else if (/\s/u.test(character) && depth === 0) break;
      cursor += 1;
    }
    destinations.push({
      destination: content.slice(start, cursor),
      image,
    });
    index = Math.max(cursor + 1, closingBracket + 1);
  }
  return { destinations, imageReferenceLabels };
}
