import { builderAiEditTestFixture } from '@baci/shared/test-fixtures/builder-ai-edit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleBuilderAiEditRequest } from './handle-builder-ai-edit-request';

describe('handleBuilderAiEditRequest event logging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records timeout and refused candidates with allowlisted request-scoped events', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const response = await handleBuilderAiEditRequest(
      new Request('http://localhost/api/builder/ai-edit', { method: 'POST' }),
      {
        dependencies: {
          authenticate: async () => ({
            supabase: {} as never,
            user: { id: 'user-1' } as never,
          }),
          checkCsrf: async () => ({ valid: true }),
          getMerchant: async () => ({
            merchantId: builderAiEditTestFixture.request.merchantId,
            staffAccess: {
              isOwner: true,
              isStaff: false,
              permissions: {},
              role: null,
            },
          }),
          materializeProviders: () => ({
            providers: [
              { model: {} as never, name: 'cerebras:gemma-4-31b' },
              { model: {} as never, name: 'groq:openai/gpt-oss-120b' },
            ],
          }),
          rateLimit: () => ({ allowed: true, remaining: 4, resetIn: 60_000 }),
          readBody: async () => ({
            body: builderAiEditTestFixture.request,
            ok: true as const,
          }),
          runProviderChain: async (options) => {
            options.logger?.warn({
              errorClass: 'TimeoutError',
              provider: 'cerebras:gemma-4-31b',
            });
            return { operations: [], reason: 'Unsupported', status: 'refused' };
          },
        },
      }
    );

    expect(response.status).toBe(422);
    expect(info).toHaveBeenCalledWith(
      'builder_ai_event',
      expect.objectContaining({
        event: 'builder_ai_timeout',
        requestId: builderAiEditTestFixture.request.clientRequestId,
      })
    );
    expect(info).toHaveBeenCalledWith(
      'builder_ai_event',
      expect.objectContaining({
        event: 'builder_ai_candidate_rejected',
        requestId: builderAiEditTestFixture.request.clientRequestId,
      })
    );
  });
});
