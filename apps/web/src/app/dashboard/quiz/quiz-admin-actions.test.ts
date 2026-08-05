import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateQuizEvent,
  buildQuizAnswerKeyReview,
  clampNumber,
  clampNumberInput,
  generateQuizDraft,
  isQuizDifficulty,
  topicsFromTextarea,
} from './quiz-admin-actions';

const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

const PRIZE_PRODUCT_ID = '55555555-5555-4555-8555-555555555555';

function validGenerationResponse() {
  return {
    event: {
      id: 'event-1',
      slug: 'daily-phone-quiz',
      status: 'draft',
      title: 'Daily Phone Quiz',
    },
    questions: [
      {
        correctOptionId: 'b',
        difficulty: 'standard' as const,
        explanation: 'USB-C arrived on iPhone 15.',
        options: [
          { id: 'a', label: 'iPhone 13' },
          { id: 'b', label: 'iPhone 15' },
        ],
        prompt: 'Which iPhone model introduced USB-C?',
        topic: 'iPhone buying advice',
      },
    ],
  };
}

function validGenerationInput() {
  return {
    difficulty: 'standard' as const,
    mode: 'test' as const,
    prizeProduct: {
      available: true,
      condition: 'new',
      defaultVariantId: null,
      effectiveStock: 2,
      hasVariants: false,
      id: PRIZE_PRODUCT_ID,
      imageUrl: 'https://cdn.example.com/iphone.png',
      manageStock: true,
      name: 'iPhone 15 Pro Max',
      price: 2100000,
      requiresVariantSelection: false,
      selectionId: `${PRIZE_PRODUCT_ID}:product`,
      variantId: null,
      variantLabel: null,
    },
    questionCountPerTopic: 1,
    timeLimitSeconds: 30,
    title: 'Daily Phone Quiz',
    topics: ['iPhone buying advice', 'Android tips'],
  };
}

describe('quiz-admin-actions pure helpers', () => {
  it('splits topics on newlines and commas, trimming and dropping blanks', () => {
    expect(topicsFromTextarea(' iPhone advice ,\n Android tips \n\n')).toEqual([
      'iPhone advice',
      'Android tips',
    ]);
  });

  it('clamps numbers within bounds and falls back to the minimum for non-finite input', () => {
    expect(clampNumber(5, 1, 10)).toBe(5);
    expect(clampNumber(-3, 1, 10)).toBe(1);
    expect(clampNumber(99, 1, 10)).toBe(10);
    expect(clampNumber(Number.NaN, 2, 10)).toBe(2);
  });

  it('clamps stringified numeric input', () => {
    expect(clampNumberInput('42', 1, 5)).toBe('5');
    expect(clampNumberInput('not-a-number', 3, 9)).toBe('3');
  });

  it('recognizes only the supported difficulty levels', () => {
    expect(isQuizDifficulty('easy')).toBe(true);
    expect(isQuizDifficulty('standard')).toBe(true);
    expect(isQuizDifficulty('hard')).toBe(true);
    expect(isQuizDifficulty('impossible')).toBe(false);
  });

  it('builds a reviewed answer-key payload from the generated draft order', () => {
    expect(
      buildQuizAnswerKeyReview(validGenerationResponse().questions)
    ).toEqual({
      questions: [{ correctOptionId: 'b', position: 1 }],
    });
  });
});

describe('generateQuizDraft', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it('posts normalized topics and returns the parsed generation response', async () => {
    mockApiPost.mockResolvedValue(validGenerationResponse());

    const result = await generateQuizDraft(validGenerationInput());

    expect(mockApiPost).toHaveBeenCalledWith('/api/merchant/quiz/generate', {
      difficulty: 'standard',
      mode: 'test',
      prizeCondition: 'new',
      prizeEffectiveStock: 2,
      prizeImageUrl: 'https://cdn.example.com/iphone.png',
      prizeProductId: PRIZE_PRODUCT_ID,
      questionCountPerTopic: 1,
      timeLimitSeconds: 30,
      title: 'Daily Phone Quiz',
      topics: ['iPhone buying advice', 'Android tips'],
    });
    expect(result.event.id).toBe('event-1');
    expect(result.questions).toHaveLength(1);
  });

  it('throws before calling the API when no topics are provided', async () => {
    await expect(
      generateQuizDraft({ ...validGenerationInput(), topics: [] })
    ).rejects.toThrow('Add at least one quiz topic before generating.');
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('throws before calling the API when no prize product is selected', async () => {
    await expect(
      generateQuizDraft({
        ...validGenerationInput(),
        prizeProduct: {
          ...validGenerationInput().prizeProduct,
          available: false,
        },
      })
    ).rejects.toThrow('Select an active product prize before generating.');
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('propagates server errors from the API call', async () => {
    mockApiPost.mockRejectedValue(new Error('Gemma unavailable'));

    await expect(generateQuizDraft(validGenerationInput())).rejects.toThrow(
      'Gemma unavailable'
    );
  });

  it('throws a validation error when the response shape is invalid', async () => {
    mockApiPost.mockResolvedValue({ event: null, questions: [] });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(generateQuizDraft(validGenerationInput())).rejects.toThrow(
      /Invalid quiz generation response:/
    );
    expect(consoleError).toHaveBeenCalledWith(
      'Invalid quiz generation response',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});

describe('activateQuizEvent', () => {
  const launch = {
    maxAttempts: 10,
    mode: 'test' as const,
    rulesVersion: 'test-v1',
    timePerQuestionSeconds: 10,
    timeZone: 'Africa/Lagos',
    timing: { kind: 'immediate' as const, liveWindowSeconds: 300 },
    variantsPerQuestion: 1,
  };
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it('posts a confirmed activation and returns the parsed response', async () => {
    mockApiPost.mockResolvedValue({
      event: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
    });

    const answerKeyReview = {
      questions: [{ correctOptionId: 'b', position: 1 }],
    };

    const result = await activateQuizEvent('event-1', answerKeyReview, launch);

    // Activation posts to its OWN path so it is not throttled by the expensive
    // Gemma-generation rate-limit bucket.
    expect(mockApiPost).toHaveBeenCalledWith('/api/merchant/quiz/activate', {
      answerKeyReview,
      confirmActivation: true,
      eventId: 'event-1',
      ...launch,
    });
    expect(result.event.status).toBe('active');
  });

  it('includes scheduled universal timing in the payload', async () => {
    mockApiPost.mockResolvedValue({
      event: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
    });

    const answerKeyReview = {
      questions: [{ correctOptionId: 'b', position: 1 }],
    };
    const timing = {
      endsAt: '2999-01-01T00:05:00.000Z',
      kind: 'scheduled' as const,
      startsAt: '2999-01-01T00:00:00.000Z',
    };

    await activateQuizEvent('event-1', answerKeyReview, { ...launch, timing });

    expect(mockApiPost).toHaveBeenCalledWith('/api/merchant/quiz/activate', {
      answerKeyReview,
      confirmActivation: true,
      eventId: 'event-1',
      ...launch,
      timing,
    });
  });

  it('propagates server errors from the activation call', async () => {
    mockApiPost.mockRejectedValue(new Error('Failed to open quiz event'));

    await expect(
      activateQuizEvent(
        'event-1',
        { questions: [{ correctOptionId: 'b', position: 1 }] },
        launch
      )
    ).rejects.toThrow('Failed to open quiz event');
  });

  it('throws a validation error when the activation response is invalid', async () => {
    mockApiPost.mockResolvedValue({ event: { id: 'event-1' } });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      activateQuizEvent(
        'event-1',
        { questions: [{ correctOptionId: 'b', position: 1 }] },
        launch
      )
    ).rejects.toThrow(/Invalid quiz activation response:/);
    expect(consoleError).toHaveBeenCalledWith(
      'Invalid quiz activation response',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});
