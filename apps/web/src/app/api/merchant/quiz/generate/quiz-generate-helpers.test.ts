import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedQuizQuestion } from '@/schemas/quiz';
import {
  activateMerchantQuizDraft,
  createSlotRows,
  createVariantRows,
  hashAnswerKey,
  isQuizDraftEvent,
  type QuizSupabaseClient,
  slugifyTitle,
} from './quiz-generate-helpers';

function buildQuestion(
  overrides: Partial<GeneratedQuizQuestion> = {}
): GeneratedQuizQuestion {
  return {
    correctOptionId: 'b',
    difficulty: 'standard',
    explanation: 'USB-C arrived on iPhone 15.',
    options: [
      { id: 'a', label: 'iPhone 13' },
      { id: 'b', label: 'iPhone 15' },
    ],
    prompt: 'Which iPhone model introduced USB-C?',
    topic: 'iPhone buying advice',
    ...overrides,
  } as GeneratedQuizQuestion;
}

describe('slugifyTitle', () => {
  it('slugifies a title and appends an 8-char hex suffix', () => {
    expect(slugifyTitle('Daily Phone Quiz!')).toMatch(
      /^daily-phone-quiz-[0-9a-f]{8}$/
    );
  });

  it('falls back to a "quiz" base when the title has no alphanumerics', () => {
    expect(slugifyTitle('!!! ???')).toMatch(/^quiz-[0-9a-f]{8}$/);
  });
});

describe('hashAnswerKey', () => {
  it('hashes case- and whitespace-insensitively', () => {
    expect(hashAnswerKey('  B  ')).toBe(hashAnswerKey('b'));
  });

  it('produces the expected sha256 hex digest', () => {
    const expected = crypto.createHash('sha256').update('b').digest('hex');
    expect(hashAnswerKey('B')).toBe(expected);
    expect(hashAnswerKey('b')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('createSlotRows', () => {
  it('maps each question to an active slot with a 1-based slot index', () => {
    const slots = createSlotRows([
      buildQuestion({ topic: 'Topic A' }),
      buildQuestion({ topic: 'Topic B', difficulty: 'hard' }),
    ]);

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      active: true,
      category: 'Topic A',
      difficulty: 'standard',
      slot_index: 1,
    });
    expect(slots[1]).toMatchObject({
      category: 'Topic B',
      difficulty: 'hard',
      slot_index: 2,
    });
    expect(slots[0]?.id).not.toBe(slots[1]?.id);
  });
});

describe('createVariantRows', () => {
  it('links each variant to its slot and hashes the answer key', () => {
    const questions = [
      buildQuestion(),
      buildQuestion({ correctOptionId: 'a' }),
    ];
    const slots = createSlotRows(questions);
    const variants = createVariantRows(questions, slots);

    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      active: true,
      answer_key_hash: hashAnswerKey('b'),
      prompt: 'Which iPhone model introduced USB-C?',
      slot_id: slots[0]?.id,
      variant_key: 'gemma-1',
    });
    expect(variants[1]?.answer_key_hash).toBe(hashAnswerKey('a'));
    expect(variants[1]?.variant_key).toBe('gemma-2');
  });

  it('throws when a question has no matching slot', () => {
    const questions = [buildQuestion(), buildQuestion()];
    const slots = createSlotRows([buildQuestion()]); // only one slot

    expect(() => createVariantRows(questions, slots)).toThrow(
      'Quiz slot creation returned an incomplete result'
    );
  });
});

describe('isQuizDraftEvent', () => {
  it('accepts a fully-formed draft event', () => {
    expect(
      isQuizDraftEvent({
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'draft',
        title: 'Daily Phone Quiz',
      })
    ).toBe(true);
  });

  it('rejects non-objects and objects missing required string fields', () => {
    expect(isQuizDraftEvent(null)).toBe(false);
    expect(isQuizDraftEvent('event')).toBe(false);
    expect(isQuizDraftEvent({ id: 'event-1', slug: 'daily-phone-quiz' })).toBe(
      false
    );
    expect(
      isQuizDraftEvent({
        id: 1,
        slug: 'x',
        status: 'draft',
        title: 't',
      })
    ).toBe(false);
  });
});

type EqCall = [string, string];

interface QuizEventsHarness {
  supabase: QuizSupabaseClient;
  updatePayload: () => Record<string, unknown> | undefined;
  eqCalls: () => EqCall[];
  activeEqCalls: () => EqCall[];
  selectArg: () => string | undefined;
}

function buildQuizEventsHarness(
  update: { data: unknown; error: unknown },
  active: { data: unknown; error: unknown } = { data: null, error: null },
  draft: { data: unknown; error: unknown } = {
    data: {
      settings: {
        answer_key_reviewed: true,
        answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
      },
    },
    error: null,
  }
): QuizEventsHarness {
  const eqCalls: EqCall[] = [];
  const draftEqCalls: EqCall[] = [];
  const activeEqCalls: EqCall[] = [];
  let updatePayload: Record<string, unknown> | undefined;
  let selectArg: string | undefined;

  // update → eq → eq → eq → select → maybeSingle
  const updateBuilder = {
    eq: vi.fn((column: string, value: string) => {
      eqCalls.push([column, value]);
      return updateBuilder;
    }),
    select: vi.fn((columns: string) => {
      selectArg = columns;
      return updateBuilder;
    }),
    maybeSingle: vi.fn(async () => update),
  };

  // Review preflight: select(settings) → eq → eq → eq → maybeSingle
  const draftBuilder = {
    eq: vi.fn((column: string, value: string) => {
      draftEqCalls.push([column, value]);
      return draftBuilder;
    }),
    maybeSingle: vi.fn(async () => draft),
  };

  // Idempotent fallback: select → eq → eq → eq → maybeSingle
  const activeBuilder = {
    eq: vi.fn((column: string, value: string) => {
      activeEqCalls.push([column, value]);
      return activeBuilder;
    }),
    maybeSingle: vi.fn(async () => active),
  };

  const from = vi.fn((table: string) => {
    if (table !== 'quiz_events') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return updateBuilder;
      }),
      select: vi.fn((columns: string) =>
        columns === 'settings' ? draftBuilder : activeBuilder
      ),
    };
  });

  return {
    activeEqCalls: () => activeEqCalls,
    eqCalls: () => eqCalls,
    selectArg: () => selectArg,
    supabase: { from } as unknown as QuizSupabaseClient,
    updatePayload: () => updatePayload,
  };
}

describe('activateMerchantQuizDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flips only the merchant-owned draft row to active and returns it', async () => {
    const harness = buildQuizEventsHarness({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1'
    );

    expect(result).toMatchObject({ id: 'event-1', status: 'active' });
    expect(harness.updatePayload()).toMatchObject({
      ends_at: null,
      status: 'active',
    });
    expect(typeof harness.updatePayload()?.starts_at).toBe('string');
    // Activation is scoped to the caller's own DRAFT event.
    expect(harness.eqCalls()).toEqual([
      ['id', 'event-1'],
      ['merchant_id', 'merchant-1'],
      ['status', 'draft'],
    ]);
    expect(harness.selectArg()).toBe('id, slug, status, title');
  });

  it('ignores a deadline on a NON-ranked quiz (the finalizer skips those)', async () => {
    // The default harness draft has no ranked-prize settings. Persisting ends_at
    // on such an event would strand it 'active' (surfaced as `open`) while
    // start_quiz_attempt rejects every start past the deadline — an open quiz
    // that can never be played.
    const harness = buildQuizEventsHarness({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1',
      '2999-01-01T00:00:00.000Z'
    );

    expect(result).toMatchObject({ id: 'event-1', status: 'active' });
    expect(harness.updatePayload()).toMatchObject({
      ends_at: null,
      status: 'active',
    });
  });

  it('persists a deadline on a product-prize quiz so lifecycle closure can run', async () => {
    const harness = buildQuizEventsHarness(
      {
        data: {
          id: 'event-1',
          slug: 'product-prize',
          status: 'active',
          title: 'Product Prize',
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          settings: {
            answer_key_reviewed: true,
            answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
            prize_product_id: 'product-1',
          },
        },
        error: null,
      }
    );
    const endsAt = '2999-01-01T00:00:00.000Z';

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1',
      endsAt
    );

    expect(result).toMatchObject({ id: 'event-1', status: 'active' });
    expect(harness.updatePayload()).toMatchObject({ ends_at: endsAt });
  });

  it('keeps a product-prize quiz open-ended when its deadline is omitted', async () => {
    const harness = buildQuizEventsHarness(
      {
        data: {
          id: 'event-1',
          slug: 'product-prize',
          status: 'active',
          title: 'Product Prize',
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          settings: {
            answer_key_reviewed: true,
            answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
            prize_product_id: 'product-1',
          },
        },
        error: null,
      }
    );

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1'
    );

    expect(result).toMatchObject({ id: 'event-1', status: 'active' });
    expect(harness.updatePayload()).toMatchObject({ ends_at: null });
  });

  it.each([
    '',
    '   ',
  ])('does not treat %j as a product-prize id', async (prizeProductId) => {
    const harness = buildQuizEventsHarness(
      {
        data: {
          id: 'event-1',
          slug: 'plain-quiz',
          status: 'active',
          title: 'Plain Quiz',
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          settings: {
            answer_key_reviewed: true,
            answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
            prize_product_id: prizeProductId,
          },
        },
        error: null,
      }
    );

    await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1',
      '2999-01-01T00:00:00.000Z'
    );

    expect(harness.updatePayload()).toMatchObject({ ends_at: null });
  });

  it('refuses to activate a ranked-prize draft without a close deadline', async () => {
    const harness = buildQuizEventsHarness(
      {
        data: { id: 'event-1', slug: 'rw', status: 'active', title: 'RW' },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          settings: {
            answer_key_reviewed: true,
            answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
            ranked_winner_count: 3,
          },
        },
        error: null,
      }
    );

    // No deadline for a ranked-prize quiz -> refused (it would never mint).
    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1'
    );

    expect(result).toBeNull();
    expect(harness.updatePayload()).toBeUndefined();
  });

  it('activates a ranked-prize draft when a deadline is provided', async () => {
    const harness = buildQuizEventsHarness(
      {
        data: { id: 'event-1', slug: 'rw', status: 'active', title: 'RW' },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          settings: {
            answer_key_reviewed: true,
            answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
            ranked_winner_count: 3,
          },
        },
        error: null,
      }
    );

    const endsAt = '2999-01-01T00:00:00.000Z';
    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1',
      endsAt
    );

    expect(result).toMatchObject({ id: 'event-1', status: 'active' });
    expect(harness.updatePayload()).toMatchObject({ ends_at: endsAt });
  });

  it('returns null when the update errors', async () => {
    const harness = buildQuizEventsHarness({
      data: null,
      error: { message: 'db error' },
    });

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1'
    );

    expect(result).toBeNull();
    expect(harness.eqCalls()).toContainEqual(['status', 'draft']);
  });

  it('is idempotent: returns the already-active event when no draft row matches', async () => {
    // No draft row (already active / lost response) + an owned active event
    // with the same id ⇒ return it instead of failing.
    const harness = buildQuizEventsHarness(
      { data: null, error: null },
      {
        data: {
          id: 'event-1',
          slug: 'daily-phone-quiz',
          status: 'active',
          title: 'Daily Phone Quiz',
        },
        error: null,
      },
      { data: null, error: null }
    );

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1'
    );

    expect(result).toMatchObject({ id: 'event-1', status: 'active' });
    // The fallback lookup is scoped to the caller's own ACTIVE event.
    expect(harness.activeEqCalls()).toEqual([
      ['id', 'event-1'],
      ['merchant_id', 'merchant-1'],
      ['status', 'active'],
    ]);
  });

  it('returns null when neither a draft nor an owned active event exists', async () => {
    const harness = buildQuizEventsHarness(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null }
    );

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1'
    );

    expect(result).toBeNull();
  });

  it('returns null when the update returns a malformed row', async () => {
    const harness = buildQuizEventsHarness({
      data: { id: 'event-1', status: 'active' },
      error: null,
    });

    const result = await activateMerchantQuizDraft(
      harness.supabase,
      'event-1',
      'merchant-1'
    );

    expect(result).toBeNull();
  });
});
