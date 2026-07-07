import { vi } from 'vitest';

export function createSupabaseRpcMock(quote: unknown) {
  const quoteRecord =
    quote && typeof quote === 'object' && !Array.isArray(quote)
      ? {
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          provider: 'GIGL',
          ...(quote as Record<string, unknown>),
        }
      : quote;

  return {
    rpc: vi.fn().mockResolvedValue({
      data: quoteRecord ? [quoteRecord] : [],
      error: null,
    }),
  };
}
