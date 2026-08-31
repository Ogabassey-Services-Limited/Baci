import { decodeHtmlEntities } from './decode-html-entities';
import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';

const URL_ATTRIBUTE_NAMES = new Set(['href', 'src', 'srcset']);
const INSPECTABLE_TAG_NAMES = new Set(['a', 'img', 'source']);

function findTagEnd(content: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < content.length; index += 1) {
    const character = content[index];
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '>') return index;
  }
  return -1;
}

function readAttributeValue(
  content: string,
  start: number,
  end: number
): { value: string; next: number } | null {
  let cursor = start;
  while (/\s/u.test(content[cursor] ?? '')) cursor += 1;
  if (content[cursor] !== '=') return null;
  cursor += 1;
  while (/\s/u.test(content[cursor] ?? '')) cursor += 1;
  const quote = content[cursor];
  if (quote === '"' || quote === "'") {
    const valueStart = ++cursor;
    while (cursor < end && content[cursor] !== quote) cursor += 1;
    return {
      value: content.slice(valueStart, cursor),
      next: Math.min(cursor + 1, end),
    };
  }
  const valueStart = cursor;
  while (cursor < end && !/\s/u.test(content[cursor] ?? '')) cursor += 1;
  return { value: content.slice(valueStart, cursor), next: cursor };
}

function splitSrcset(value: string): string[] {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/u)[0] ?? '');
}

function readTagName(
  content: string,
  start: number
): { name: string; next: number } | null {
  let cursor = start + 1;
  while (/\s/u.test(content[cursor] ?? '')) cursor += 1;
  if (
    content[cursor] === '/' ||
    content[cursor] === '!' ||
    content[cursor] === '?'
  )
    return null;
  const tagStart = cursor;
  while (/[A-Za-z0-9:-]/u.test(content[cursor] ?? '')) cursor += 1;
  const name = content.slice(tagStart, cursor).toLowerCase();
  return INSPECTABLE_TAG_NAMES.has(name) ? { name, next: cursor } : null;
}

function inspectTag(content: string, start: number, end: number): boolean {
  const tag = readTagName(content, start);
  if (tag === null) return false;
  const tagName = tag.name;
  let cursor = tag.next;
  const attributes = new Map<string, string>();
  const seenUrlAttributes = new Set<string>();
  while (cursor < end) {
    while (/\s|\//u.test(content[cursor] ?? '')) cursor += 1;
    if (cursor >= end) break;
    const nameStart = cursor;
    while (!/[\s=/>]/u.test(content[cursor] ?? '')) cursor += 1;
    const name = content.slice(nameStart, cursor).toLowerCase();
    if (URL_ATTRIBUTE_NAMES.has(name)) {
      if (seenUrlAttributes.has(name)) return true;
      seenUrlAttributes.add(name);
    }
    const parsed = readAttributeValue(content, cursor, end);
    if (parsed === null) {
      while (cursor < end && !/\s/u.test(content[cursor] ?? '')) cursor += 1;
      continue;
    }
    attributes.set(name, decodeHtmlEntities(parsed.value));
    cursor = parsed.next;
  }
  const mediaValues = ['src', 'srcset']
    .filter(
      (name) => tagName === 'img' || tagName === 'source' || name === 'src'
    )
    .flatMap((name) => {
      const value = attributes.get(name);
      return value === undefined
        ? []
        : name === 'srcset'
          ? splitSrcset(value)
          : [value];
    });
  if (
    (tagName === 'img' || tagName === 'source') &&
    mediaValues.some((value) => !value || !isStablePublicMediaUrl(value))
  )
    return true;
  const href = attributes.get('href');
  return tagName === 'a' && href !== undefined && !isSafePublicReleaseUrl(href);
}

/** Scans HTML tags using quote-aware start-tag parsing. */
export function hasUnstableHtmlContent(content: string): boolean {
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== '<') continue;
    if (content.startsWith('<!--', index)) {
      const commentEnd = content.indexOf('-->', index + 4);
      if (commentEnd === -1) return true;
      index = commentEnd + 2;
      continue;
    }
    if (readTagName(content, index) === null) continue;
    const end = findTagEnd(content, index);
    if (end === -1) break;
    if (inspectTag(content, index, end)) return true;
    index = end;
  }
  return false;
}
