function blankRange(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1)
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
}

function readMarkdownLineIndent(
  content: string,
  lineStart: number,
  lineEnd: number
): { cursor: number; spaces: number } {
  let cursor = lineStart;
  // A blockquote marker is part of the Markdown container, not indentation.
  // Consume nested markers before measuring code indentation so quoted code is
  // masked just like an unquoted four-space code block.
  while (true) {
    let probe = cursor;
    let prefixSpaces = 0;
    while (probe < lineEnd && content[probe] === '\t') {
      probe += 1;
      prefixSpaces += 4;
    }
    while (probe < lineEnd && content[probe] === ' ') {
      probe += 1;
      prefixSpaces += 1;
    }
    if (prefixSpaces > 3 || content[probe] !== '>') break;
    cursor = probe + 1;
    if (content[cursor] === ' ') cursor += 1;
  }
  let spaces = 0;
  while (cursor < lineEnd && content[cursor] === '\t') {
    cursor += 1;
    spaces += 4;
  }
  while (cursor < lineEnd && content[cursor] === ' ') {
    cursor += 1;
    spaces += 1;
  }
  return { cursor, spaces };
}

/** Replaces fenced and inline Markdown code with spaces while preserving lines. */
export function maskMarkdownCode(content: string): string {
  const chars = content.split('');
  const length = content.length;
  let activeListIndent: number | null = null;
  let activeListCodeIndent: number | null = null;
  let index = 0;
  while (index < length) {
    const lineStart = index === 0 || content[index - 1] === '\n';
    if (lineStart) {
      let lineEnd = content.indexOf('\n', index);
      if (lineEnd === -1) lineEnd = length;
      const { cursor, spaces } = readMarkdownLineIndent(
        content,
        index,
        lineEnd
      );
      const lineText = content.slice(cursor, lineEnd);
      const isBlankLine = lineText.trim().length === 0;
      const listMarkerMatch = /^(?:[-+*]|\d+[.)])(?:[ \t]+|$)/u.exec(lineText);
      const isListMarker = listMarkerMatch !== null;
      if (isListMarker && spaces < 4) {
        activeListIndent = spaces;
        activeListCodeIndent = spaces + (listMarkerMatch?.[0].length ?? 0) + 4;
      } else if (
        !isBlankLine &&
        (activeListIndent === null || spaces <= activeListIndent)
      ) {
        activeListIndent = null;
        activeListCodeIndent = null;
      }
      const isListContinuation =
        activeListIndent !== null && spaces > activeListIndent;
      const isNestedListCode =
        activeListCodeIndent !== null && spaces >= activeListCodeIndent;
      if ((spaces >= 4 && !isListContinuation) || isNestedListCode) {
        blankRange(chars, index, lineEnd);
        index = lineEnd;
        continue;
      }
      const fenceCharacter = content[cursor];
      if (
        (fenceCharacter === '`' || fenceCharacter === '~') &&
        (spaces <= 3 || isListContinuation)
      ) {
        let runLength = 0;
        while (content[cursor + runLength] === fenceCharacter) runLength += 1;
        if (runLength >= 3) {
          let close = -1;
          let search = content.indexOf('\n', cursor + runLength);
          while (search !== -1 && search + 1 < length) {
            const candidate = search + 1;
            let candidateCursor = candidate;
            let candidateSpaces = 0;
            while (candidateSpaces < 4 && content[candidateCursor] === ' ') {
              candidateCursor += 1;
              candidateSpaces += 1;
            }
            let candidateRun = 0;
            while (content[candidateCursor + candidateRun] === fenceCharacter)
              candidateRun += 1;
            let lineEnd = candidateCursor + candidateRun;
            while (lineEnd < length && content[lineEnd] !== '\n') lineEnd += 1;
            let restIsWhitespace = true;
            for (
              let restCursor = candidateCursor + candidateRun;
              restCursor < lineEnd;
              restCursor += 1
            ) {
              if (!/\s/u.test(content[restCursor] ?? '')) {
                restIsWhitespace = false;
                break;
              }
            }
            if (
              candidateSpaces <= (isListContinuation ? spaces : 3) &&
              candidateRun >= runLength &&
              restIsWhitespace
            ) {
              close = candidateCursor + candidateRun;
              break;
            }
            search = content.indexOf('\n', candidateCursor + candidateRun);
          }
          blankRange(chars, index, close === -1 ? length : close);
          index = close === -1 ? length : close;
          continue;
        }
      }
    }
    if (content[index] !== '`' || (index > 0 && content[index - 1] === '\\')) {
      index += 1;
      continue;
    }
    let runLength = 1;
    while (content[index + runLength] === '`') runLength += 1;
    const delimiter = '`'.repeat(runLength);
    let close = content.indexOf(delimiter, index + runLength);
    while (close !== -1) {
      const preceding = content[close - 1];
      const following = content[close + runLength];
      if (preceding === '\\' || preceding === '`' || following === '`') {
        close = content.indexOf(delimiter, close + runLength);
        continue;
      }
      break;
    }
    if (close !== -1) {
      blankRange(chars, index, close + runLength);
      index = close + runLength;
    } else index += runLength;
  }
  return chars.join('');
}
