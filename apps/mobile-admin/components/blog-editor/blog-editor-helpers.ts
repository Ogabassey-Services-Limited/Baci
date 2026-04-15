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
  const bufferedBody = await response.text();
  const trimmedBody = bufferedBody.trim();

  if (contentType.includes('application/json') && trimmedBody.length > 0) {
    try {
      const data = JSON.parse(bufferedBody);

      if (typeof data?.error === 'string' && data.error.trim().length > 0) {
        return `${statusPrefix}: ${data.error.trim()}`;
      }
    } catch {
      return `${statusPrefix}: ${trimmedBody}`;
    }
  }

  if (trimmedBody.length > 0) {
    return `${statusPrefix}: ${trimmedBody}`;
  }

  return statusPrefix;
}
