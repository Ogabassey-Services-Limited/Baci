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

function matchesSensitiveValue(
  value: string,
  startIndex: number,
  sensitiveValue: string
): boolean {
  for (let index = 0; index < sensitiveValue.length; index += 1) {
    const character = sensitiveValue[index];
    if (character === '%' && value[startIndex + index] === '%') {
      const expectedEscape = sensitiveValue.slice(index + 1, index + 3);
      const actualEscape = value.slice(
        startIndex + index + 1,
        startIndex + index + 3
      );
      if (
        /^[0-9a-f]{2}$/i.test(expectedEscape) &&
        expectedEscape.toLowerCase() === actualEscape.toLowerCase()
      ) {
        index += 2;
        continue;
      }
    }
    if (character !== value[startIndex + index]) return false;
  }
  return true;
}

function redactSensitiveValues(
  value: string,
  sensitiveValues: readonly string[]
): string {
  let redactedValue = '';
  for (let index = 0; index < value.length; ) {
    const sensitiveValue = sensitiveValues.find((candidate) =>
      matchesSensitiveValue(value, index, candidate)
    );
    if (sensitiveValue) {
      redactedValue += '[redacted]';
      index += sensitiveValue.length;
      continue;
    }
    redactedValue += value[index];
    index += 1;
  }
  return redactedValue;
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
  const redactedValue = redactSensitiveValues(value, exactSensitiveValues);
  return redactedValue
    .replace(EMAIL, '[redacted-email]')
    .replace(LONG_NUMBER, '[redacted-number]')
    .replace(SECRET, '$1=[redacted]')
    .slice(0, 2_000);
}
