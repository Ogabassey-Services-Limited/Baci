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

const mockEventSingle = vi.fn();
const mockSlotSelect = vi.fn();
const mockVariantInsert = vi.fn();

const mockFrom = vi.fn((table: string) => {
  if (table === 'quiz_events') {
    return {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: mockEventSingle })),
      })),
    };
  }

  if (table === 'quiz_question_slots') {
    return {
      insert: vi.fn(() => ({ select: vi.fn(() => mockSlotSelect()) })),
    };
  }

  if (table === 'quiz_question_variants') {
    return {
      insert: vi.fn(() => mockVariantInsert()),
    };
  }

  return {};
});

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
    prizeName: 'Quiz prize',
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
      supabase: { from: mockFrom },
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
    mockEventSingle.mockResolvedValue({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'draft',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });
    mockSlotSelect.mockResolvedValue({
      data: [{ category: 'iPhone buying advice', id: 'slot-1', slot_index: 1 }],
      error: null,
    });
    mockVariantInsert.mockResolvedValue({ error: null });
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

  it('returns 500 when quiz event, slot, or variant persistence fails', async () => {
    mockEventSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'event insert failed' },
    });
    const eventFailure = await POST(createRequest(validPayload()));
    expect(eventFailure.status).toBe(500);
    expect(await eventFailure.json()).toEqual({
      error: 'Failed to create quiz event',
    });

    mockSlotSelect.mockResolvedValueOnce({
      data: null,
      error: { message: 'slot insert failed' },
    });
    const slotFailure = await POST(createRequest(validPayload()));
    expect(slotFailure.status).toBe(500);
    expect(await slotFailure.json()).toEqual({
      error: 'Failed to create quiz topics',
    });

    mockVariantInsert.mockResolvedValueOnce({
      error: { message: 'variant insert failed' },
    });
    const variantFailure = await POST(createRequest(validPayload()));
    expect(variantFailure.status).toBe(500);
    expect(await variantFailure.json()).toEqual({
      error: 'Failed to create quiz questions',
    });
  });
});
