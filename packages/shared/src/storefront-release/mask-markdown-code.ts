function blankRange(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1)
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
}

/** Replaces fenced and inline Markdown code with spaces while preserving lines. */
export function maskMarkdownCode(content: string): string {
  const chars = content.split('');
  const length = content.length;
  let index = 0;
  while (index < length) {
    const lineStart = index === 0 || content[index - 1] === '\n';
    if (lineStart) {
      let cursor = index;
      let spaces = 0;
      while (content[cursor] === '\t') {
        cursor += 1;
        spaces += 4;
      }
      while (spaces < 4 && content[cursor] === ' ') {
        cursor += 1;
        spaces += 1;
      }
      if (spaces >= 4) {
        let lineEnd = content.indexOf('\n', index);
        if (lineEnd === -1) lineEnd = length;
        blankRange(chars, index, lineEnd);
        index = lineEnd;
        continue;
      }
      const fenceCharacter = content[cursor];
      if ((fenceCharacter === '`' || fenceCharacter === '~') && spaces <= 3) {
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
              candidateSpaces <= 3 &&
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
    let close = content.indexOf('`'.repeat(runLength), index + runLength);
    while (close !== -1 && close > 0 && content[close - 1] === '\\')
      close = content.indexOf('`'.repeat(runLength), close + runLength);
    if (close !== -1) {
      blankRange(chars, index, close + runLength);
      index = close + runLength;
    } else index += runLength;
  }
  return chars.join('');
}
