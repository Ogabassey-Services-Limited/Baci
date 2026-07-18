const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LONG_NUMBER = /\+?\d[\d\s().-]{8,}\d/g;
const SECRET =
  /(["']?(?:[a-z0-9_-]*?(?:authorization|cookie|password|secret|token)[a-z0-9_-]*)["']?)\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,\r\n}\]]+)/gi;

function transportRepresentations(value: string): string[] {
  const jsonString = JSON.stringify(value);
  const representations = [value, jsonString.slice(1, -1)];
  try {
    representations.push(encodeURIComponent(value));
  } catch {
    // Keep raw and JSON representations for malformed Unicode.
  }
  representations.push(
    new URLSearchParams({ value }).toString().slice('value='.length)
  );
  return representations;
}

function sensitiveValuePattern(value: string): string {
  let pattern = '';
  for (let index = 0; index < value.length; ) {
    const percentEscape = value.slice(index, index + 3);
    if (/^%[0-9a-f]{2}$/i.test(percentEscape)) {
      pattern += [...percentEscape]
        .map((character) =>
          /[a-f]/i.test(character)
            ? `[${character.toLowerCase()}${character.toUpperCase()}]`
            : character
        )
        .join('');
      index += 3;
      continue;
    }
    pattern += value[index]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') ?? '';
    index += 1;
  }
  return pattern;
}

export function sanitizeEventErrorMessage(
  value: string | undefined,
  sensitiveValues: readonly string[] = []
): string | undefined {
  if (!value) return undefined;
  const exactSensitiveValues = [
    ...new Set(
      sensitiveValues
        .filter((sensitiveValue) => sensitiveValue.length > 0)
        .flatMap(transportRepresentations)
    ),
  ].sort((left, right) => right.length - left.length);
  const redactedValue = exactSensitiveValues.length
    ? value.replace(
        new RegExp(
          exactSensitiveValues.map(sensitiveValuePattern).join('|'),
          'g'
        ),
        '[redacted]'
      )
    : value;
  return redactedValue
    .replace(EMAIL, '[redacted-email]')
    .replace(LONG_NUMBER, '[redacted-number]')
    .replace(SECRET, '$1=[redacted]')
    .slice(0, 2_000);
}
