import { generateText, Output } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { builderAiPlanOutputBudget } from '@/lib/builder-ai/builder-ai-plan-output-budget';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { json: vi.fn(() => 'json-output') },
}));

interface SmokeModule {
  BUILDER_AI_JSON_SMOKE_PROMPT: string;
  runProviderSmoke: (
    provider: { model: object; name: string },
    signal: AbortSignal
  ) => Promise<boolean>;
}

const smokeModulePath = './builder-ai-json-transport-worker';
const provider = { model: { id: 'cerebras-model' }, name: 'cerebras:model' };
const validOutput = {
  operations: [
    {
      componentId: 'smoke-hero',
      kind: 'update_component',
      patch: { componentType: 'Hero', title: 'Smoke checked' },
    },
  ],
  status: 'proposed',
  summary: 'Update the smoke hero title',
};

function loadSmokeModule(): Promise<SmokeModule> {
  return import(smokeModulePath) as Promise<SmokeModule>;
}

describe('runProviderSmoke transport adapter', () => {
  it('describes the complete closed JSON shape while keeping AI SDK schema-free', async () => {
    const { BUILDER_AI_JSON_SMOKE_PROMPT } = await loadSmokeModule();

    expect(BUILDER_AI_JSON_SMOKE_PROMPT).toBe(
      'Return only JSON with status "proposed", a summary string, and exactly one update_component operation for componentId "smoke-hero". Its patch must contain only componentType "Hero" and title "Smoke checked". Do not return markdown, extra keys, code, HTML, or explanations.'
    );
  });

  it('forwards valid generated output with the shared provider-safe output cap', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: validOutput } as never);
    const { runProviderSmoke } = await loadSmokeModule();
    const controller = new AbortController();

    await expect(runProviderSmoke(provider, controller.signal)).resolves.toBe(true);
    expect(Output.json).toHaveBeenCalledOnce();
    expect(Output.json).toHaveBeenCalledWith();
    expect(generateText).toHaveBeenCalledWith({
      abortSignal: controller.signal,
      maxOutputTokens: builderAiPlanOutputBudget.maxOutputTokens,
      maxRetries: 0,
      model: provider.model,
      output: 'json-output',
      prompt:
        'Return only JSON with status "proposed", a summary string, and exactly one update_component operation for componentId "smoke-hero". Its patch must contain only componentType "Hero" and title "Smoke checked". Do not return markdown, extra keys, code, HTML, or explanations.',
    });
  });

  it('forwards invalid generated output into the same predicate', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { status: 'proposed' } } as never);
    const { runProviderSmoke } = await loadSmokeModule();
    const controller = new AbortController();

    await expect(runProviderSmoke(provider, controller.signal)).resolves.toBe(false);
    expect(vi.mocked(generateText).mock.calls[0]?.[0]).not.toHaveProperty('schema');
  });

  it('fails before provider transport when the shared output budget is not approved', async () => {
    vi.mocked(generateText).mockClear();
    vi.spyOn(builderAiPlanOutputBudget, 'isApproved').mockReturnValue(false);
    const { runProviderSmoke } = await loadSmokeModule();
    const controller = new AbortController();

    await expect(runProviderSmoke(provider, controller.signal)).rejects.toThrow(
      'Builder AI output budget is not approved'
    );
    expect(generateText).not.toHaveBeenCalled();
  });
});
