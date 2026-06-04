import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOllamaAgenticChatResponse } from '@/lib/ollama-agentic-chat';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'searchProducts',
      description: 'Search products',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: { query: { type: 'string' } },
      },
    },
  },
];

describe('createOllamaAgenticChatResponse', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('runs Ollama tool calls and sends tool results back for the final answer', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: {
              content: '',
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'searchProducts',
                    arguments: { query: 'iPhone 11' },
                  },
                },
              ],
            },
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: {
              content: 'The iPhone 11 is available from the live catalog.',
            },
          })
        )
      );
    const executeToolCall = vi.fn(async () =>
      JSON.stringify({ products: [{ id: 'p1', name: 'iPhone 11' }] })
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await createOllamaAgenticChatResponse({
      baseUrl: 'https://ollama.example.com/api/',
      model: 'gemma4:e4b\n',
      messages: [{ role: 'user', content: 'Do you have iPhone 11?' }],
      tools,
      executeToolCall,
    });

    expect(await response.text()).toBe(
      'The iPhone 11 is available from the live catalog.'
    );
    expect(executeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        function: expect.objectContaining({
          name: 'searchProducts',
          arguments: { query: 'iPhone 11' },
        }),
      })
    );

    const firstBody = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(firstBody).toMatchObject({
      model: 'gemma4:e4b',
      stream: false,
      think: false,
      tools,
      options: { num_ctx: 4096, num_predict: 384 },
    });

    const secondBody = JSON.parse(String(mockFetch.mock.calls[1][1]?.body));
    expect(secondBody.messages).toEqual([
      { role: 'user', content: 'Do you have iPhone 11?' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            type: 'function',
            function: {
              name: 'searchProducts',
              arguments: { query: 'iPhone 11' },
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_name: 'searchProducts',
        content: JSON.stringify({
          products: [{ id: 'p1', name: 'iPhone 11' }],
        }),
      },
    ]);
  });

  it('returns direct content when Ollama does not request a tool', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: { content: 'Hello' } }))
        )
    );

    const response = await createOllamaAgenticChatResponse({
      baseUrl: 'https://ollama.example.com',
      model: 'gemma4:e4b',
      messages: [{ role: 'user', content: 'Hi' }],
      tools,
      executeToolCall: vi.fn(),
    });

    expect(await response.text()).toBe('Hello');
  });

  it('encodes Basic Auth before sending tool-capable requests', async () => {
    const basicAuth = 'test-user:test-password';
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: 'Hello' } }))
      );
    vi.stubGlobal('fetch', mockFetch);

    await createOllamaAgenticChatResponse({
      baseUrl: 'https://ollama.example.com',
      model: 'gemma4:e4b',
      messages: [{ role: 'user', content: 'Hi' }],
      tools,
      executeToolCall: vi.fn(),
      basicAuth,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: buildOllamaBasicAuthHeader(basicAuth),
        }),
      })
    );
  });

  it('rejects empty final content', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: { content: '   ' } }))
        )
    );

    await expect(
      createOllamaAgenticChatResponse({
        baseUrl: 'https://ollama.example.com',
        model: 'gemma4:e4b',
        messages: [{ role: 'user', content: 'Hi' }],
        tools,
        executeToolCall: vi.fn(),
      })
    ).rejects.toThrow('Chat returned an empty completion');
  });
});
