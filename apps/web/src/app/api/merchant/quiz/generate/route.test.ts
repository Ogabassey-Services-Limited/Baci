import crypto from 'node:crypto';
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
    prize_condition: string;
    prize_product_id: string;
    prize_product_image_url: string | null;
    prize_product_name: string;
    prize_variant_id: string | null;
    quiz_mode: string;
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
const mockPrizeProductMaybeSingle = vi.fn();
const mockQuizDraftSingle = vi.fn();
const mockQuizEventUpdateSingle = vi.fn();
const mockQuizEventSelect = vi.fn(() => ({
  single: mockQuizEventUpdateSingle,
}));
const mockQuizEventEqThird = vi.fn(() => ({ select: mockQuizEventSelect }));
const mockQuizEventEqSecond = vi.fn(() => ({ eq: mockQuizEventEqThird }));
const mockQuizEventEqFirst = vi.fn(() => ({ eq: mockQuizEventEqSecond }));
const mockQuizEventUpdate = vi.fn(() => ({ eq: mockQuizEventEqFirst }));
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
  if (table === 'quiz_events') {
    return {
      update: mockQuizEventUpdate,
    };
  }
  if (table === 'products') {
    return mockPrizeProductBuilder;
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

const PRIZE_PRODUCT_ID = '55555555-5555-4555-8555-555555555555';

function hashAnswerKey(answer: string): string {
  return crypto
    .createHash('sha256')
    .update(answer.trim().toLowerCase())
    .digest('hex');
}

function createRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/merchant/quiz/generate', {
    body: JSON.stringify({
      mode: 'test',
      prizeCondition: 'unspecified',
      prizeEffectiveStock: null,
      prizeImageUrl: 'https://cdn.example.com/iphone-15-pro-max.png',
      ...body,
    }),
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
    mockPrizeProductMaybeSingle.mockResolvedValue({
      data: {
        condition: null,
        default_variant_id: null,
        has_variants: false,
        id: PRIZE_PRODUCT_ID,
        images: [{ url: 'https://cdn.example.com/iphone-15-pro-max.png' }],
        manage_stock: false,
        merchant_id: 'merchant-1',
        name: 'iPhone 15 Pro Max',
        stock: null,
        stock_quantity: null,
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
    mockQuizEventUpdateSingle.mockResolvedValue({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });
  });

  it('generates Gemma questions and saves them as a merchant-owned draft quiz', async () => {
    const response = await POST(
      createRequest({
        difficulty: 'standard',
        prizeProductId: PRIZE_PRODUCT_ID,
        publicationMode: 'draft',
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
        prize_name: 'iPhone 15 Pro Max',
        prize_condition: 'unspecified',
        prize_product_id: PRIZE_PRODUCT_ID,
        prize_product_image_url:
          'https://cdn.example.com/iphone-15-pro-max.png',
        prize_product_name: 'iPhone 15 Pro Max',
        prize_variant_id: null,
        quiz_mode: 'test',
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
          answer_key_hash: hashAnswerKey('b'),
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
          // The AI-marked answer key IS returned to the authenticated admin so
          // they can review it before opening the quiz.
          correctOptionId: 'b',
          explanation: 'USB-C arrived on iPhone 15.',
          prompt: 'Which iPhone model introduced USB-C?',
          topic: 'iPhone buying advice',
        },
      ],
    });
    // Generating a draft must never auto-open the event.
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
    expect(mockPrizeProductBuilder.select).toHaveBeenCalledWith(
      'id, merchant_id, name, images, condition, default_variant_id, has_variants, manage_stock, stock, stock_quantity'
    );
    expect(mockPrizeProductBuilder.eq).toHaveBeenCalledWith(
      'id',
      PRIZE_PRODUCT_ID
    );
    expect(mockPrizeProductBuilder.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(mockPrizeProductBuilder.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('does not activate from the generation route — an activation-shaped body is rejected', async () => {
    // Activation moved to POST /api/merchant/quiz/activate (its own rate-limit
    // bucket). The generation route must NOT open events; an activation-only
    // body has no title/topics, so it fails generation validation.
    const response = await POST(
      createRequest({
        confirmActivation: true,
        eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })
    );

    expect(response.status).toBe(400);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
    expect(mockGenerateQuizQuestionsWithGemma).not.toHaveBeenCalled();
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
