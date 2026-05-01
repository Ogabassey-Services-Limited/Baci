const RAW_BASIC_CREDENTIALS_PATTERN = /^[^\p{Cc}:]*:[^\p{Cc}]*$/u;
const BASIC_AUTH_PAYLOAD_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;

function encodeUtf8Base64(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Normalizes Ollama Basic Auth config into an HTTP Authorization header.
 *
 * Accepts raw credentials (`user:password`), a full header
 * (`Basic dXNlcjpwYXNz`), or a bare base64/base64url payload
 * (`dXNlcjpwYXNz`). Empty input, malformed headers, and invalid payload
 * characters return null.
 */
export function buildOllamaBasicAuthHeader(basicAuth: string): string | null {
  const credentials = basicAuth.trim();

  if (!credentials) {
    return null;
  }

  if (/^Basic$/i.test(credentials)) {
    return null;
  }

  const basicHeaderMatch = credentials.match(/^Basic\s+(.+)$/i);
  if (basicHeaderMatch) {
    const payload = basicHeaderMatch[1]?.trim() ?? '';
    if (!BASIC_AUTH_PAYLOAD_PATTERN.test(payload)) {
      return null;
    }
    return `Basic ${payload}`;
  }

  if (RAW_BASIC_CREDENTIALS_PATTERN.test(credentials)) {
    return `Basic ${encodeUtf8Base64(credentials)}`;
  }

  if (!BASIC_AUTH_PAYLOAD_PATTERN.test(credentials)) {
    return null;
  }

  return `Basic ${credentials}`;
}
