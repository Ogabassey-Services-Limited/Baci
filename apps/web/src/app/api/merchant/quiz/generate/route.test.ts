import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockGenerateQuizQuestionsWithGemma = vi.fn();

type QuizDraftRpcArgs = {
  p_merchant_id: string;
  p_settings: {
    prize_name: string;
    time_limit_seconds: number;
  };
  p_slug: string;
  p_slots: Array<{
    active: boolean;
    category: string;
    difficulty: string;
    id: string;
    slot_index: number;
  }>;
  p_title: string;
  p_variants: Array<{
    active: boolean;
    answer_key_hash: string;
    options: Array<{ id: string; label: string }>;
    prompt: string;
    slot_id: string;
    variant_key: string;
  }>;
};

let lastQuizDraftRpcArgs: QuizDraftRpcArgs | null = null;
const mockMerchantMaybeSingle = vi.fn();
const mockQuizDraftSingle = vi.fn();
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

  return {};
});
const mockRpc = vi.fn((name: string, args: QuizDraftRpcArgs) => {
  if (name === 'create_merchant_quiz_draft') {
    lastQuizDraftRpcArgs = args;
  }
  return { single: mockQuizDraftSingle };
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
    lastQuizDraftRpcArgs = null;
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: mockFrom, rpc: mockRpc },
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
    mockMerchantMaybeSingle.mockResolvedValue({
      data: {
        business_name: 'OgaBassey Gadgets',
        slug: 'ogabassey',
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
          { id: 'c', label: 'iPhone 12' },
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
      merchantName: 'OgaBassey Gadgets',
      questionCountPerTopic: 1,
      topics: ['iPhone buying advice'],
    });
    expect(mockRpc).toHaveBeenCalledWith('create_merchant_quiz_draft', {
      p_merchant_id: 'merchant-1',
      p_settings: {
        prize_name: '₦10,000 voucher',
        time_limit_seconds: 30,
      },
      p_slug: expect.stringMatching(/^daily-phone-quiz-[0-9a-f]{8}$/),
      p_slots: [
        expect.objectContaining({
          active: true,
          category: 'iPhone buying advice',
          difficulty: 'standard',
          id: expect.any(String),
          slot_index: 1,
        }),
      ],
      p_title: 'Daily Phone Quiz',
      p_variants: [
        expect.objectContaining({
          active: true,
          answer_key_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
          options: [
            { id: 'a', label: 'iPhone 13' },
            { id: 'b', label: 'iPhone 15' },
            { id: 'c', label: 'iPhone 12' },
          ],
          prompt: 'Which iPhone model introduced USB-C?',
          slot_id: expect.any(String),
          variant_key: 'gemma-1',
        }),
      ],
    });
    expect(lastQuizDraftRpcArgs).not.toBeNull();
    const rpcArgs = lastQuizDraftRpcArgs;
    if (!rpcArgs) {
      throw new Error('Expected quiz draft RPC args to be captured');
    }
    expect(rpcArgs.p_variants[0]?.slot_id).toBe(rpcArgs.p_slots[0]?.id);
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
