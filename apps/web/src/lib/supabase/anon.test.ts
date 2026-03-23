import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/env', () => ({
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseUrl: () => 'https://test.supabase.co',
}));

import { createPublicClient } from '@/lib/supabase/anon';

describe('createPublicClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({});
  });

  it('uses only the timeout signal when no caller signal is provided', async () => {
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutSignal);
    const anySpy = vi.spyOn(AbortSignal, 'any');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null));

    createPublicClient({
      clientInfo: 'baci-web-live-blog-post',
      timeoutMs: 50,
    });
    const options = mockCreateClient.mock.calls[0][2] as {
      global: {
        fetch: (url: string, requestOptions?: RequestInit) => Promise<Response>;
      };
    };

    await options.global.fetch('https://example.com/data', {
      headers: { 'X-Test': '1' },
    });

    expect(timeoutSpy).toHaveBeenCalledWith(50);
    expect(anySpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/data', {
      headers: { 'X-Test': '1' },
      signal: timeoutSignal,
    });
  });

  it('composes caller and timeout signals when both are present', async () => {
    const callerSignal = new AbortController().signal;
    const timeoutSignal = new AbortController().signal;
    const combinedSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutSignal);
    const anySpy = vi.spyOn(AbortSignal, 'any').mockReturnValue(combinedSignal);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null));

    createPublicClient({
      clientInfo: 'baci-web-live-blog-post',
      timeoutMs: 75,
    });
    const options = mockCreateClient.mock.calls[0][2] as {
      global: {
        fetch: (url: string, requestOptions?: RequestInit) => Promise<Response>;
      };
    };

    await options.global.fetch('https://example.com/data', {
      headers: { 'X-Test': '2' },
      signal: callerSignal,
    });

    expect(timeoutSpy).toHaveBeenCalledWith(75);
    expect(anySpy).toHaveBeenCalledWith([callerSignal, timeoutSignal]);
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/data', {
      headers: { 'X-Test': '2' },
      signal: combinedSignal,
    });
  });
});
