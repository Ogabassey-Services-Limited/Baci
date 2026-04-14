export function normalizeBlogPostId(
  id: string | string[] | undefined
): string | null {
  if (Array.isArray(id)) {
    return id[0] ?? null;
  }

  return id ?? null;
}

export async function readEditorApiError(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const statusPrefix = `${fallbackMessage} (${response.status})`;
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();

      if (typeof data?.error === 'string' && data.error.trim().length > 0) {
        return `${statusPrefix}: ${data.error.trim()}`;
      }
    } catch {
      return statusPrefix;
    }
  }

  try {
    const text = await response.text();

    if (text.trim().length > 0) {
      return `${statusPrefix}: ${text.trim()}`;
    }
  } catch {
    return statusPrefix;
  }

  return statusPrefix;
}
