import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_FEEDBACK_BODY_BYTES = 32_768;
const FEEDBACK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface PetrockFeedbackCapture {
  bodyBytes: number;
  bodyKeys: string[];
  bodySha256: string;
  contentType: string;
  tooLarge: false;
}

export function hashPetrockFeedbackToken(token: string): string | null {
  if (!FEEDBACK_TOKEN_PATTERN.test(token)) return null;
  const decoded = Buffer.from(token, 'base64url');
  if (decoded.byteLength !== 32) return null;
  return createHash('sha256').update(token).digest('hex');
}

export function petrockFeedbackHashesMatch(
  candidate: string,
  expected: string
): boolean {
  if (!SHA256_PATTERN.test(candidate) || !SHA256_PATTERN.test(expected)) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(candidate, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

function extractBodyKeys(contentType: string, body: Uint8Array): string[] {
  const text = new TextDecoder().decode(body);
  try {
    if (contentType === 'application/json') {
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return Object.keys(parsed).slice(0, 50).sort();
      }
    }
    if (contentType === 'application/x-www-form-urlencoded') {
      return [...new Set(new URLSearchParams(text).keys())].slice(0, 50).sort();
    }
  } catch {
    return [];
  }
  return [];
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_FEEDBACK_BODY_BYTES
  ) {
    return null;
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FEEDBACK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function capturePetrockFeedbackBody(
  request: Request
): Promise<PetrockFeedbackCapture | { tooLarge: true }> {
  const body = await readBoundedBody(request);
  if (!body) return { tooLarge: true };

  const contentType = (request.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  return {
    bodyBytes: body.byteLength,
    bodyKeys: extractBodyKeys(contentType, body),
    bodySha256: createHash('sha256').update(body).digest('hex'),
    contentType,
    tooLarge: false,
  };
}
