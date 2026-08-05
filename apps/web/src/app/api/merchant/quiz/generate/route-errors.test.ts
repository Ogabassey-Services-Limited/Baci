import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockGenerateQuizQuestionsWithGemma = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const MockUnavailableError = vi.hoisted(
  () =>
    class QuizQuestionGenerationUnavailableError extends Error {
      constructor() {
        super('Gemma quiz question generation is not configured');
      }
    }
);

const mockMerchantMaybeSingle = vi.fn();
const mockPrizeProductMaybeSingle = vi.fn();
const mockQuizDraftSingle = vi.fn();
const mockPrizeProductBuilder = {
  eq: vi.fn(() => mockPrizeProductBuilder),
  maybeSingle: mockPrizeProductMaybeSingle,
  select: vi.fn(() => mockPrizeProductBuilder),
};
const mockFrom = vi.fn((table: string) => {
  if (table === 'merchants') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMerchantMaybeSingle,
        })),
      })),
    };
  }
  if (table === 'products') {
    return mockPrizeProductBuilder;
  }

  return {};
});
const mockRpc = vi.fn(() => ({ single: mockQuizDraftSingle }));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/quiz/gemma-question-generator', () => ({
  generateQuizQuestionsWithGemma: (...args: unknown[]) =>
    mockGenerateQuizQuestionsWithGemma(...args),
  QuizQuestionGenerationUnavailableError: MockUnavailableError,
}));

const { POST } = await import('./route');

const PRIZE_PRODUCT_ID = '55555555-5555-4555-8555-555555555555';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/merchant/quiz/generate', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }) as unknown as NextRequest;
}

function createRawRequest(body: string): NextRequest {
  return new Request('http://localhost/api/merchant/quiz/generate', {
    body,
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }) as unknown as NextRequest;
}

function validPayload() {
  return {
    difficulty: 'standard',
    prizeCondition: 'new',
    prizeEffectiveStock: 8,
    prizeImageUrl: 'https://cdn.example.com/iphone.png',
    prizeProductId: PRIZE_PRODUCT_ID,
    questionCountPerTopic: 1,
    timeLimitSeconds: 30,
    title: 'Daily Phone Quiz',
    topics: ['iPhone buying advice'],
  };
}

describe('POST /api/merchant/quiz/generate errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: mockFrom, rpc: mockRpc },
      user: { id: 'user-1' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
    mockGetUserAccess.mockResolvedValue({
      isOwner: true,
      isStaff: false,
      merchantId: 'merchant-1',
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockMerchantMaybeSingle.mockResolvedValue({
      data: {
        business_name: 'OgaBassey Gadgets',
        slug: 'ogabassey',
      },
      error: null,
    });
    mockPrizeProductMaybeSingle.mockResolvedValue({
      data: {
        condition: 'new',
        default_variant_id: null,
        has_variants: false,
        id: PRIZE_PRODUCT_ID,
        images: [{ url: 'https://cdn.example.com/iphone.png' }],
        manage_stock: true,
        merchant_id: 'merchant-1',
        name: 'iPhone 15 Pro Max',
        stock: 8,
        stock_quantity: 0,
      },
      error: null,
    });
    mockGenerateQuizQuestionsWithGemma.mockResolvedValue([
      {
        correctOptionId: 'b',
        difficulty: 'standard',
        explanation: 'USB-C arrived on iPhone 15.',
        options: [
          { id: 'a', label: 'iPhone 13' },
          { id: 'b', label: 'iPhone 15' },
        ],
        prompt: 'Which iPhone model introduced USB-C?',
        topic: 'iPhone buying advice',
      },
    ]);
    mockQuizDraftSingle.mockResolvedValue({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'draft',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await POST(createRequest(validPayload()));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 when the merchant access record cannot be resolved', async () => {
    mockGetUserAccess.mockResolvedValue(null);

    const response = await POST(createRequest(validPayload()));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
  });

  it('rejects invalid JSON and invalid request bodies', async () => {
    const invalidJson = await POST(createRawRequest('{'));
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toEqual({ error: 'Invalid JSON' });

    const invalidBody = await POST(createRequest({ title: 'No', topics: [] }));
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toMatchObject({ error: 'Invalid input' });
  });

  it('rejects non-Ogabassey merchants before generating questions', async () => {
    mockMerchantMaybeSingle.mockResolvedValueOnce({
      data: {
        business_name: 'Another Store',
        slug: 'another-store',
      },
      error: null,
    });

    const response = await POST(createRequest(validPayload()));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Quiz generation is only available for Ogabassey',
    });
    expect(mockGenerateQuizQuestionsWithGemma).not.toHaveBeenCalled();
    expect(mockQuizDraftSingle).not.toHaveBeenCalled();
  });

  it('rejects prize products outside the active merchant catalog', async () => {
    mockPrizeProductMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await POST(createRequest(validPayload()));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'INVALID_PRIZE_PRODUCT',
      error: 'Select an active Ogabassey product as the quiz prize',
    });
    expect(mockGenerateQuizQuestionsWithGemma).not.toHaveBeenCalled();
    expect(mockQuizDraftSingle).not.toHaveBeenCalled();
  });

  it('maps Gemma configuration and generation failures to client-safe errors', async () => {
    mockGenerateQuizQuestionsWithGemma.mockRejectedValueOnce(
      new MockUnavailableError()
    );

    const unavailable = await POST(createRequest(validPayload()));

    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      error: 'Gemma quiz generation is not configured',
    });

    mockGenerateQuizQuestionsWithGemma.mockRejectedValueOnce(
      new Error('upstream failed')
    );

    const failed = await POST(createRequest(validPayload()));

    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({
      error: 'Failed to generate quiz questions',
    });
  });

  it('returns 500 when the atomic quiz draft RPC fails', async () => {
    mockQuizDraftSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'quiz draft insert failed' },
    });
    const rpcFailure = await POST(createRequest(validPayload()));
    expect(rpcFailure.status).toBe(500);
    expect(await rpcFailure.json()).toEqual({
      error: 'Failed to create quiz draft',
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'create_merchant_quiz_draft',
      expect.objectContaining({ p_merchant_id: 'merchant-1' })
    );

    mockQuizDraftSingle.mockResolvedValueOnce({
      data: { id: 'event-1' },
      error: null,
    });
    const malformedRpcResponse = await POST(createRequest(validPayload()));
    expect(malformedRpcResponse.status).toBe(500);
    expect(await malformedRpcResponse.json()).toEqual({
      error: 'Failed to create quiz draft',
    });
  });
});
