import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockGenerateQuizQuestionsWithGemma = vi.fn();

let eventInsertPayload: unknown = null;
let slotInsertPayload: unknown = null;
let variantInsertPayload: unknown = null;

const mockEventSingle = vi.fn();
const mockSlotSelect = vi.fn();
const mockVariantInsert = vi.fn();

const mockFrom = vi.fn((table: string) => {
  if (table === 'quiz_events') {
    return {
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn((payload: unknown) => {
        eventInsertPayload = payload;
        return {
          select: vi.fn(() => ({
            single: mockEventSingle,
          })),
        };
      }),
    };
  }

  if (table === 'quiz_question_slots') {
    return {
      insert: vi.fn((payload: unknown) => {
        slotInsertPayload = payload;
        return {
          select: vi.fn(() => mockSlotSelect()),
        };
      }),
    };
  }

  if (table === 'quiz_question_variants') {
    return {
      insert: vi.fn((payload: unknown) => {
        variantInsertPayload = payload;
        return mockVariantInsert();
      }),
    };
  }

  return {};
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/quiz/gemma-question-generator', () => ({
  generateQuizQuestionsWithGemma: (...args: unknown[]) =>
    mockGenerateQuizQuestionsWithGemma(...args),
}));

const { POST } = await import('./route');

function createRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/merchant/quiz/generate', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }) as unknown as NextRequest;
}

describe('POST /api/merchant/quiz/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventInsertPayload = null;
    slotInsertPayload = null;
    variantInsertPayload = null;
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: mockFrom },
      user: { id: 'user-1' },
    });
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
          { id: 'c', label: 'iPhone 12' },
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
      data: [
        {
          category: 'iPhone buying advice',
          id: 'slot-1',
          slot_index: 1,
        },
      ],
      error: null,
    });
    mockVariantInsert.mockResolvedValue({ error: null });
  });

  it('generates Gemma questions and saves them as a merchant-owned draft quiz', async () => {
    const response = await POST(
      createRequest({
        difficulty: 'standard',
        prizeName: '₦10,000 voucher',
        questionCountPerTopic: 1,
        timeLimitSeconds: 30,
        title: 'Daily Phone Quiz',
        topics: ['iPhone buying advice'],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockGenerateQuizQuestionsWithGemma).toHaveBeenCalledWith({
      difficulty: 'standard',
      merchantName: 'merchant-1',
      questionCountPerTopic: 1,
      topics: ['iPhone buying advice'],
    });
    expect(eventInsertPayload).toMatchObject({
      merchant_id: 'merchant-1',
      settings: {
        prize_name: '₦10,000 voucher',
        time_limit_seconds: 30,
      },
      slug: 'daily-phone-quiz',
      status: 'draft',
      title: 'Daily Phone Quiz',
    });
    expect(slotInsertPayload).toEqual([
      expect.objectContaining({
        category: 'iPhone buying advice',
        difficulty: 'standard',
        event_id: 'event-1',
        slot_index: 1,
      }),
    ]);
    expect(variantInsertPayload).toEqual([
      expect.objectContaining({
        active: true,
        answer_key_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        options: [
          { id: 'a', label: 'iPhone 13' },
          { id: 'b', label: 'iPhone 15' },
          { id: 'c', label: 'iPhone 12' },
        ],
        prompt: 'Which iPhone model introduced USB-C?',
        slot_id: 'slot-1',
        variant_key: 'gemma-1',
      }),
    ]);
    expect(body).toMatchObject({
      event: {
        id: 'event-1',
        status: 'draft',
        title: 'Daily Phone Quiz',
      },
      questions: [
        {
          prompt: 'Which iPhone model introduced USB-C?',
          topic: 'iPhone buying advice',
        },
      ],
    });
  });

  it('requires marketing edit permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await POST(
      createRequest({
        title: 'Daily Phone Quiz',
        topics: ['iPhone buying advice'],
      })
    );

    expect(response.status).toBe(403);
    expect(mockGenerateQuizQuestionsWithGemma).not.toHaveBeenCalled();
  });

  it('rejects requests that fail csrf validation', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
      valid: false,
    });

    const response = await POST(
      createRequest({
        title: 'Daily Phone Quiz',
        topics: ['iPhone buying advice'],
      })
    );

    expect(response.status).toBe(403);
    expect(mockGenerateQuizQuestionsWithGemma).not.toHaveBeenCalled();
  });
});
