import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlmChatResponse } from '@/lib/llm-chat';

const VALID_BEARER = 'a'.repeat(64);

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe('createLlmChatResponse stream parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams text content from OpenAI SSE delta chunks', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      '',
      'data: [DONE]',
      '',
      '',
    ].join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(streamFromText(sse)))
    );

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('Hello world');
  });

  it('ignores SSE chunks without delta content', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"answer"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(streamFromText(sse)))
    );

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('answer');
  });

  it('terminates cleanly on the [DONE] sentinel and ignores following chunks', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"early"}}]}',
      '',
      'data: [DONE]',
      '',
      'data: {"choices":[{"delta":{"content":"late should be ignored"}}]}',
      '',
    ].join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(streamFromText(sse)))
    );

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('early');
  });

  it('cancels the upstream body after an early [DONE] sentinel', async () => {
    const cancel = vi.fn();
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              'data: {"choices":[{"delta":{"content":"early"}}]}',
              '',
              'data: [DONE]',
              '',
              'data: {"choices":[{"delta":{"content":"late"}}]}',
              '',
            ].join('\n')
          )
        );
      },
      cancel,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(upstream)));

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('early');
    expect(cancel).toHaveBeenCalled();
  });

  it('surfaces malformed SSE payloads without leaking the chunk content', async () => {
    expect.assertions(3);
    const sse =
      'data: {"choices":[{"delta":{"content":"customer phone secret"\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(streamFromText(sse)))
    );

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    try {
      await response.text();
      throw new Error('Expected malformed SSE chunk to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw error;
      expect(error.message).toMatch(/Invalid LLM chat chunk JSON/i);
      expect(error.message).not.toContain('customer phone secret');
    }
  });

  it('sanitizes streamed upstream error chunks before rejecting', async () => {
    expect.assertions(5);
    const verboseMessage = `<html>\n${'stack trace '.repeat(40)}</html>`;
    const sse = `data: ${JSON.stringify({
      error: { message: verboseMessage },
    })}\n\n`;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(streamFromText(sse)))
    );

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    try {
      await response.text();
      throw new Error('Expected streamed error chunk to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw error;
      expect(error.message).toContain('<html>');
      expect(error.message).not.toContain('\n');
      expect(error.message.length).toBeLessThanOrEqual(201);
      expect(error.message).toMatch(/…$/);
    }
  });
});
