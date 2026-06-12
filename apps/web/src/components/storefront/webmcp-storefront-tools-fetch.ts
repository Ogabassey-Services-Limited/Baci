export type JsonResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export async function fetchJson<T>(
  url: string,
  signal?: AbortSignal
): Promise<JsonResult<T>> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
      status: 0,
    };
  }
}

export async function fetchText(
  url: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'text/markdown, text/plain;q=0.9' },
      signal,
    });

    return response.ok ? response.text() : null;
  } catch (error) {
    console.warn('[WebMCP] Failed to fetch text document', { url, error });
    return null;
  }
}
