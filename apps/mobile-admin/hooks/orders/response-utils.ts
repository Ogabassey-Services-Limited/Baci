export function parseResponsePayload(
  text: string
): Record<string, unknown> | string | null {
  if (!text) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }

    return text;
  } catch {
    return text;
  }
}
