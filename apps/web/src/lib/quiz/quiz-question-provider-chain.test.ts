import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.hoisted(() => vi.fn());
const getCopilotTextProviderChainMock = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({ generateText: generateTextMock }));
vi.mock('@/ai/copilot-provider-chain', () => ({
  getCopilotTextProviderChain: getCopilotTextProviderChainMock,
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const CEREBRAS = { name: 'cerebras:gemma-4-31b', model: 'cerebras-model' };
const GROQ = { name: 'groq:openai/gpt-oss-120b', model: 'groq-model' };

function runOptions(overrides: Partial<{ abortSignal: AbortSignal }> = {}) {
  return {
    system: 'system prompt',
    prompt: 'user prompt',
    maxOutputTokens: 2400,
    temperature: 0.35,
    abortSignal: new AbortController().signal,
    ...overrides,
  };
}

describe('quiz question provider chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCopilotTextProviderChainMock.mockReturnValue([CEREBRAS, GROQ]);
  });

  it('generates on Cerebras Gemma 4 first and does not call any fallback', async () => {
    generateTextMock.mockResolvedValueOnce({ text: '{"questions":[]}' });

    const { runQuizQuestionProviderChain } = await import(
      './quiz-question-provider-chain'
    );
    const content = await runQuizQuestionProviderChain(runOptions());

    expect(content).toBe('{"questions":[]}');
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: CEREBRAS.model,
        system: 'system prompt',
        prompt: 'user prompt',
        maxOutputTokens: 2400,
        temperature: 0.35,
      })
    );
  });

  it('falls through to the next provider when Cerebras fails', async () => {
    generateTextMock
      .mockRejectedValueOnce(new Error('cerebras 429'))
      .mockResolvedValueOnce({ text: '{"questions":[{}]}' });

    const { runQuizQuestionProviderChain } = await import(
      './quiz-question-provider-chain'
    );
    const content = await runQuizQuestionProviderChain(runOptions());

    expect(content).toBe('{"questions":[{}]}');
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: GROQ.model })
    );
  });

  it('treats an empty completion as a provider failure and falls through', async () => {
    generateTextMock
      .mockResolvedValueOnce({ text: '   ' })
      .mockResolvedValueOnce({ text: '{"questions":[]}' });

    const { runQuizQuestionProviderChain } = await import(
      './quiz-question-provider-chain'
    );

    await expect(runQuizQuestionProviderChain(runOptions())).resolves.toBe(
      '{"questions":[]}'
    );
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it('throws the last error when every provider fails', async () => {
    generateTextMock
      .mockRejectedValueOnce(new Error('cerebras down'))
      .mockRejectedValueOnce(new Error('groq down'));

    const { runQuizQuestionProviderChain } = await import(
      './quiz-question-provider-chain'
    );

    await expect(runQuizQuestionProviderChain(runOptions())).rejects.toThrow(
      'groq down'
    );
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it('stops immediately when the route deadline has already aborted', async () => {
    const controller = new AbortController();
    generateTextMock.mockImplementationOnce(() => {
      controller.abort();
      throw new Error('aborted');
    });

    const { runQuizQuestionProviderChain } = await import(
      './quiz-question-provider-chain'
    );

    await expect(
      runQuizQuestionProviderChain(
        runOptions({ abortSignal: controller.signal })
      )
    ).rejects.toThrow('aborted');
    // Must NOT burn the rest of the chain against a signal that already fired.
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it('reports no hosted provider when nothing is configured', async () => {
    getCopilotTextProviderChainMock.mockReturnValue([]);

    const {
      hasHostedQuizQuestionProvider,
      runQuizQuestionProviderChain,
      QuizQuestionProviderChainUnavailableError,
    } = await import('./quiz-question-provider-chain');

    expect(hasHostedQuizQuestionProvider()).toBe(false);
    await expect(
      runQuizQuestionProviderChain(runOptions())
    ).rejects.toBeInstanceOf(QuizQuestionProviderChainUnavailableError);
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
