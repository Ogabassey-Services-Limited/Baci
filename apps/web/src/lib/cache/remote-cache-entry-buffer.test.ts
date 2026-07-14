// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bufferCacheEntry,
  createEntryFromChunks,
} from './remote-cache-entry-buffer.mjs';

/**
 * `CacheEntry.value` is a single-use ReadableStream that "can error and only
 * have partial data" (Next's own CacheHandler docs). To enforce a size cap we
 * must drain it, so we also have to hand the backend a *fresh* stream.
 */
describe('bufferCacheEntry', () => {
  const encoder = new TextEncoder();

  function makeEntry(
    chunks: string[],
    overrides: Record<string, unknown> = {}
  ) {
    return {
      value: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      }),
      tags: ['products-abc'],
      stale: 300,
      timestamp: 1_000,
      expire: 86_400,
      revalidate: 300,
      ...overrides,
    };
  }

  function makeErroringEntry(error: Error) {
    return {
      value: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('partial'));
          controller.error(error);
        },
      }),
      tags: [],
      stale: 300,
      timestamp: 1_000,
      expire: 86_400,
      revalidate: 300,
    };
  }

  it('buffers an in-budget entry and reports its byte size', async () => {
    const result = await bufferCacheEntry(makeEntry(['hello', 'world']), 1024);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.bytes).toBe(10);
  });

  it('preserves the entry metadata verbatim on the rebuilt entry', async () => {
    const result = await bufferCacheEntry(makeEntry(['payload']), 1024);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.entry.tags).toEqual(['products-abc']);
    expect(result.entry.stale).toBe(300);
    expect(result.entry.timestamp).toBe(1_000);
    expect(result.entry.expire).toBe(86_400);
    expect(result.entry.revalidate).toBe(300);
  });

  it('rebuilds a readable stream carrying the identical bytes', async () => {
    const result = await bufferCacheEntry(makeEntry(['hello', 'world']), 1024);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const text = await new Response(result.entry.value).text();
    expect(text).toBe('helloworld');
  });

  it('can rebuild an independent stream per read (set + concurrent get)', async () => {
    const result = await bufferCacheEntry(makeEntry(['shared']), 1024);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const first = createEntryFromChunks(result.entry, result.chunks);
    const second = createEntryFromChunks(result.entry, result.chunks);

    // Draining one must not consume the other.
    await expect(new Response(first.value).text()).resolves.toBe('shared');
    await expect(new Response(second.value).text()).resolves.toBe('shared');
  });

  it('reports oversized when the payload exceeds the cap, without throwing', async () => {
    const result = await bufferCacheEntry(makeEntry(['0123456789']), 4);

    expect(result.status).toBe('oversized');
    if (result.status !== 'oversized') return;
    expect(result.bytes).toBeGreaterThan(4);
  });

  it('stops draining as soon as the cap is exceeded', async () => {
    let enqueued = 0;
    const entry = {
      value: new ReadableStream<Uint8Array>({
        pull(controller) {
          enqueued += 1;
          controller.enqueue(encoder.encode('AAAAAAAAAA'));
          if (enqueued > 100) controller.close();
        },
      }),
      tags: [],
      stale: 300,
      timestamp: 1_000,
      expire: 86_400,
      revalidate: 300,
    };

    const result = await bufferCacheEntry(entry, 20);

    expect(result.status).toBe('oversized');
    // It must cancel early rather than drain a (potentially endless) producer.
    expect(enqueued).toBeLessThan(10);
  });

  it('reports a stream error instead of rejecting', async () => {
    const result = await bufferCacheEntry(
      makeErroringEntry(new Error('stream blew up')),
      1024
    );

    expect(result.status).toBe('stream_error');
  });

  it('never rejects even when the pending entry itself is a rejected promise', async () => {
    // The framework hands `set()` a *pending* entry; a render failure rejects it.
    await expect(
      bufferCacheEntry(
        Promise.reject(new Error('render failed')) as never,
        1024
      )
    ).resolves.toMatchObject({ status: 'stream_error' });
  });
});
