import { describe, expect, it, vi } from 'vitest';
import { readResponseJson } from './gigl.response-json';

function responseWithChunks(
  chunks: string[],
  onCancel: () => void,
  close = true
): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      cancel: onCancel,
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        if (close) {
          controller.close();
        }
      },
    })
  );
}

describe('readResponseJson', () => {
  it('preserves Response.json behavior when no byte cap is supplied', async () => {
    const response = new Response('{"ok":true}');
    const json = vi.spyOn(response, 'json');

    await expect(readResponseJson(response)).resolves.toEqual({ ok: true });

    expect(json).toHaveBeenCalledOnce();
  });

  it('rejects an invalid byte cap before reading the response', async () => {
    const response = new Response('{"ok":true}');
    const json = vi.spyOn(response, 'json');

    await expect(
      readResponseJson(response, { maxResponseBytes: 0 })
    ).rejects.toThrow(
      'GIGL response maximum size must be a positive safe integer'
    );

    expect(json).not.toHaveBeenCalled();
    expect(response.bodyUsed).toBe(false);
  });

  it('rejects oversized declared Content-Length before reading the stream', async () => {
    const onCancel = vi.fn();
    const responseBody = new ReadableStream<Uint8Array>({
      cancel: onCancel,
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":true}'));
      },
    });
    const response = new Response(responseBody, {
      headers: { 'content-length': '32' },
    });

    await expect(
      readResponseJson(response, { maxResponseBytes: 16 })
    ).rejects.toThrow('GIGL response exceeds maximum size');

    expect(onCancel).toHaveBeenCalledOnce();
    expect(response.bodyUsed).toBe(true);
  });

  it('preserves the size error when cancelling an oversized response rejects', async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          return Promise.reject(new Error('cancel failed'));
        },
      }),
      { headers: { 'content-length': '32' } }
    );

    await expect(
      readResponseJson(response, { maxResponseBytes: 16 })
    ).rejects.toThrow('GIGL response exceeds maximum size');
  });

  it('rejects an unsafe declared Content-Length before reading the stream', async () => {
    const response = new Response('{"ok":true}', {
      headers: { 'content-length': '9007199254740992' },
    });

    await expect(
      readResponseJson(response, { maxResponseBytes: 16 })
    ).rejects.toThrow('GIGL response exceeds maximum size');

    expect(response.bodyUsed).toBe(true);
  });

  it('cancels a chunked stream after its bytes exceed the cap', async () => {
    const onCancel = vi.fn();
    const response = responseWithChunks(
      ['{"value":"', 'too-large"}'],
      onCancel,
      false
    );

    await expect(
      readResponseJson(response, { maxResponseBytes: 12 })
    ).rejects.toThrow('GIGL response exceeds maximum size');

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('parses JSON after a streamed body finishes within the cap', async () => {
    const response = responseWithChunks(['{"value":', '"ok"}'], vi.fn());

    await expect(
      readResponseJson(response, { maxResponseBytes: 32 })
    ).resolves.toEqual({ value: 'ok' });
  });

  it('cancels a stalled body when its signal aborts', async () => {
    const onCancel = vi.fn();
    const controller = new AbortController();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel: onCancel,
        pull() {
          return new Promise<void>(() => undefined);
        },
      })
    );
    const request = readResponseJson(response, {
      maxResponseBytes: 32,
      signal: controller.signal,
    });
    const rejection = expect(request).rejects.toThrow();

    controller.abort();

    await rejection;
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
