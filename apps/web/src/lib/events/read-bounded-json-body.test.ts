import { describe, expect, it } from 'vitest';
import { readBoundedJsonBody } from './read-bounded-json-body';

function request(body: string, contentLength?: string) {
  return new Request('https://example.com/api/events', {
    body,
    headers: contentLength ? { 'content-length': contentLength } : undefined,
    method: 'POST',
  });
}

describe('readBoundedJsonBody', () => {
  it('parses a JSON body within the byte limit', async () => {
    await expect(
      readBoundedJsonBody(request('{"ok":true}'), 64)
    ).resolves.toEqual({ body: { ok: true }, ok: true });
  });

  it('rejects an oversized stream without relying on Content-Length', async () => {
    await expect(
      readBoundedJsonBody(request(`{"value":"${'x'.repeat(100)}"}`), 32)
    ).resolves.toEqual({ ok: false, reason: 'too_large' });
  });

  it('rejects an oversized declared Content-Length before reading', async () => {
    await expect(
      readBoundedJsonBody(request('{}', '1000'), 32)
    ).resolves.toEqual({ ok: false, reason: 'too_large' });
  });

  it('rejects malformed JSON', async () => {
    await expect(readBoundedJsonBody(request('{'), 32)).resolves.toEqual({
      ok: false,
      reason: 'invalid_json',
    });
  });
});
