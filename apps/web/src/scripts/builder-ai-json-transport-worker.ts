import { config as loadDotenv } from 'dotenv';
import { generateText, Output } from 'ai';
import { builderAiEditContract, type BuilderData } from '@baci/shared/contracts';
import { applyBuilderAiEditPlan } from '@/lib/builder-ai/apply-builder-ai-edit-plan';
import { builderAiPlanOutputBudget } from '@/lib/builder-ai/builder-ai-plan-output-budget';
import { materializeBuilderAiProviderChain } from '@/lib/builder-ai/materialize-builder-ai-provider-chain';
import { validateBuilderAiSmokeEnvironmentSource } from './builder-ai-smoke-environment-source';

export const BUILDER_AI_JSON_SMOKE_PROMPT =
  'Return only JSON with status "proposed", a summary string, and exactly one update_component operation for componentId "smoke-hero". Its patch must contain only componentType "Hero" and title "Smoke checked". Do not return markdown, extra keys, code, HTML, or explanations.';

const config: BuilderData = {
  content: [
    { props: { id: 'smoke-hero', title: 'Smoke' }, type: 'Hero' },
  ],
  root: { title: 'Smoke' },
};

interface WorkerCommand {
  deadlineMs?: number;
  kind: 'list' | 'probe';
  providerName?: string;
  sourcePath: string;
}

export function isValidBuilderAiJsonTransportSmokeResult(
  output: unknown
): boolean {
  const parsed = builderAiEditContract.modelPlanSchema.safeParse(output);
  if (!parsed.success || parsed.data.status !== 'proposed') return false;
  const [operation] = parsed.data.operations;
  if (
    parsed.data.operations.length !== 1 ||
    operation?.kind !== 'update_component' ||
    operation.componentId !== 'smoke-hero' ||
    operation.patch.componentType !== 'Hero' ||
    operation.patch.title !== 'Smoke checked' ||
    Object.keys(operation.patch).length !== 2
  ) {
    return false;
  }
  try {
    const result = applyBuilderAiEditPlan(
      config,
      parsed.data,
      (type) => `smoke-${type}`
    );
    return (
      result.warnings.length === 0 &&
      JSON.stringify(result.candidateConfig) ===
        JSON.stringify({
          ...config,
          content: [
            {
              props: { id: 'smoke-hero', title: 'Smoke checked' },
              type: 'Hero',
            },
          ],
        })
    );
  } catch {
    return false;
  }
}

export async function runProviderSmoke(
  provider: { model: Parameters<typeof generateText>[0]['model'] },
  signal: AbortSignal
): Promise<boolean> {
  if (
    !builderAiPlanOutputBudget.isApproved(
      builderAiPlanOutputBudget.maxOutputTokens
    )
  ) {
    throw new Error('Builder AI output budget is not approved');
  }
  const result = await generateText({
    abortSignal: signal,
    maxOutputTokens: builderAiPlanOutputBudget.maxOutputTokens,
    maxRetries: 0,
    model: provider.model,
    output: Output.json(),
    prompt: BUILDER_AI_JSON_SMOKE_PROMPT,
  });
  return isValidBuilderAiJsonTransportSmokeResult(result.output);
}

async function loadProviders(sourcePath: string) {
  const source = await validateBuilderAiSmokeEnvironmentSource(sourcePath);
  if (!source) return null;
  const loaded = loadDotenv({ override: false, path: source.path, quiet: true });
  if (loaded.error) return null;
  return materializeBuilderAiProviderChain(undefined, undefined, 'smoke').providers;
}

async function handle(command: WorkerCommand): Promise<void> {
  const providers = await loadProviders(command.sourcePath);
  if (!providers) {
    process.send?.({ kind: 'error' });
    return;
  }
  if (command.kind === 'list') {
    process.send?.({
      kind: 'providers',
      providers: providers.map(({ name, opportunistic }) => ({
        name,
        opportunistic,
      })),
    });
    return;
  }
  const provider = providers.find(({ name }) => name === command.providerName);
  if (!provider || !builderAiPlanOutputBudget.isApproved(builderAiPlanOutputBudget.maxOutputTokens)) {
    process.send?.({ kind: 'probe', passed: false });
    return;
  }
  try {
    const passed = await runProviderSmoke(
      provider,
      AbortSignal.timeout(command.deadlineMs ?? 5_000)
    );
    process.send?.({ kind: 'probe', passed });
  } catch {
    process.send?.({ kind: 'probe', passed: false });
  }
}

if (typeof process.send === 'function') {
  process.on('message', (command: WorkerCommand) => {
    void handle(command).catch(() => process.send?.({ kind: 'error' }));
  });
}
