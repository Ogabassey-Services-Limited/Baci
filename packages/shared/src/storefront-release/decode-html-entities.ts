import { decodeNamedCharacterReference } from 'decode-named-character-reference';

function decodeNumericReference(reference: string): string | null {
  const hexadecimal = reference.startsWith('#x') || reference.startsWith('#X');
  const digits = reference.slice(hexadecimal ? 2 : 1);
  const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff)
    return '\ufffd';
  return String.fromCodePoint(codePoint);
}

/** Decodes the complete named/numeric HTML entity vocabulary in one pass. */
export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]+)(;?)/giu,
    (
      match,
      reference: string,
      semicolon: string,
      offset: number,
      source: string
    ) => {
      if (
        !semicolon &&
        !reference.startsWith('#') &&
        /[a-z0-9=-]/iu.test(source[offset + match.length] ?? '')
      )
        return match;
      if (reference.startsWith('#'))
        return decodeNumericReference(reference) ?? match;
      const decoded = decodeNamedCharacterReference(reference);
      return decoded === false ? match : decoded;
    }
  );
}
