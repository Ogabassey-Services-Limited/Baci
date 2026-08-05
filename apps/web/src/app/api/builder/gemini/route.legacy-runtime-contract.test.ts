import { builderAiEditTestFixture } from '@baci/shared/test-fixtures/builder-ai-edit';
import { generateText } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seams = vi.hoisted(() => ({
  authenticate: vi.fn(),
  checkCsrf: vi.fn(),
  getMerchant: vi.fn(),
  materializeProviders: vi.fn(),
}));

const ai = vi.hoisted(() => {
  class NoObject extends Error {
    static isInstance(error: unknown): boolean {
      return error instanceof NoObject;
    }
  }
  return { NoObject };
});

vi.mock('ai', () => ({
  generateText: vi.fn(),
  NoObjectGeneratedError: ai.NoObject,
  Output: { json: vi.fn(() => 'json-output') },
}));
vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: seams.authenticate,
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: seams.checkCsrf }));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: seams.getMerchant,
  toUserAccess: (merchant: {
    merchantId: string;
    staffAccess: {
      isOwner: boolean;
      isStaff: boolean;
      permissions: Record<string, Record<string, boolean>>;
      role: string | null;
    };
  }) => ({
    merchantId: merchant.merchantId,
    ...merchant.staffAccess,
    role: merchant.staffAccess.role ?? 'owner',
  }),
}));
vi.mock('@/lib/api-auth', () => ({ hasPermission: () => true }));
vi.mock('@/lib/builder-ai/materialize-builder-ai-provider-chain', () => ({
  materializeBuilderAiProviderChain: seams.materializeProviders,
}));

import { POST } from './route';

const providers = [
  { model: { id: 'cerebras' } as never, name: 'cerebras:gemma-4-31b' },
  { model: { id: 'groq' } as never, name: 'groq:openai/gpt-oss-120b' },
];

describe('legacy builder route runtime contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seams.authenticate.mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' },
    });
    seams.checkCsrf.mockResolvedValue({ valid: true });
    seams.getMerchant.mockResolvedValue({
      merchantId: builderAiEditTestFixture.request.merchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: {},
        role: null,
      },
    });
    seams.materializeProviders.mockReturnValue({ providers });
  });

  afterEach(() => vi.restoreAllMocks());

  it('uses the real authentication and CSRF module seams then falls from a primary failure to a legacy config response', async () => {
    const request = new Request('http://localhost/api/builder/gemini', {
      body: JSON.stringify({
        currentConfig: builderAiEditTestFixture.request.currentConfig,
        merchantId: builderAiEditTestFixture.request.merchantId,
        prompt: builderAiEditTestFixture.request.prompt,
      }),
      headers: { Authorization: 'Bearer checked-by-auth-module' },
      method: 'POST',
    });
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error('primary unavailable'))
      .mockResolvedValueOnce({
        output: {
          operations: [
            {
              componentId: 'hero-1',
              kind: 'update_component',
              patch: { componentType: 'Hero', title: 'Fallback title' },
            },
          ],
          status: 'proposed',
          summary: 'Use fallback',
        },
      } as never);

    const response = await POST(request as never);

    expect(seams.authenticate).toHaveBeenCalledWith(request);
    expect(seams.checkCsrf).toHaveBeenCalledWith(request);
    expect(generateText).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toEqual({
      config: expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({
            props: expect.objectContaining({ title: 'Fallback title' }),
          }),
        ]),
      }),
    });
  });
});
