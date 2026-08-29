import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

export const MAX_JSONL_READ_BYTES = 32 * 1024 * 1024;
export const MAX_JSONL_ROTATED_FILES = 2;

function readFileTail(filePath, maxBytes) {
  const descriptor = openSync(filePath, 'r');
  let size;
  try {
    ({ size } = fstatSync(descriptor));
    const start = Math.max(0, size - maxBytes);
    const bytesToRead = size - start;
    const buffer = Buffer.allocUnsafe(bytesToRead);
    let bytesRead = 0;
    while (bytesRead < bytesToRead) {
      const count = readSync(
        descriptor,
        buffer,
        bytesRead,
        bytesToRead - bytesRead,
        start + bytesRead
      );
      if (count === 0) break;
      bytesRead += count;
    }

    let content = buffer.toString('utf8', 0, bytesRead);
    if (start > 0) {
      const previousByte = Buffer.alloc(1);
      const previousBytesRead = readSync(
        descriptor,
        previousByte,
        0,
        1,
        start - 1
      );
      if (previousBytesRead === 1 && previousByte[0] === 0x0a) {
        content = `\n${content}`;
      }
    }
    if (size > maxBytes && !content.startsWith('\n')) {
      const firstNewline = content.indexOf('\n');
      content = firstNewline === -1 ? '' : content.slice(firstNewline + 1);
    }
    return { bytesRead, content };
  } finally {
    closeSync(descriptor);
  }
}

function joinFileTails(chunks) {
  return chunks.reduce((combined, chunk) => {
    if (!combined) return chunk;
    if (!combined.endsWith('\n') && !chunk.startsWith('\n')) {
      return `${combined}\n${chunk}`;
    }
    return combined + chunk;
  }, '');
}

function readDrainTail(path) {
  let remainingBytes = MAX_JSONL_READ_BYTES;
  const chunks = [];
  const active = readFileTail(path, remainingBytes);
  chunks.push({ path, ...active });
  remainingBytes -= active.bytesRead;

  for (
    let index = 1;
    index <= MAX_JSONL_ROTATED_FILES && remainingBytes > 0;
    index += 1
  ) {
    const rotatedPath = `${path}.${index}`;
    let rotated;
    try {
      rotated = readFileTail(rotatedPath, remainingBytes);
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
    chunks.unshift({ path: rotatedPath, ...rotated });
    remainingBytes -= rotated.bytesRead;
  }

  return joinFileTails(chunks.map(({ content }) => content));
}

export function readJsonlLogEvents(path) {
  const content = readDrainTail(path);
  const events = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      throw new Error(
        `Invalid JSONL at ${path} (tail line ${index + 1}): ${error.message}`
      );
    }
  }
  return events;
}
