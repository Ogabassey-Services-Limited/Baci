import { config as loadDotenv } from 'dotenv';
import { generateText, Output } from 'ai';
import { pathToFileURL } from 'node:url';
import { builderAiEditContract, type BuilderData } from '@baci/shared/contracts';
import { applyBuilderAiEditPlan } from '@/lib/builder-ai/apply-builder-ai-edit-plan';
import { builderAiPlanOutputBudget } from '@/lib/builder-ai/builder-ai-plan-output-budget';
import {
  builderAiJsonTransportContract,
  type BuilderAiJsonTransportProviderDescriptor,
} from './builder-ai-json-transport-contract';
import { settleBuilderAiSmokeBeforeDeadline } from './builder-ai-smoke-deadline';
import { materializeBuilderAiProviderChain } from '@/lib/builder-ai/materialize-builder-ai-provider-chain';

export const BUILDER_AI_JSON_SMOKE_PROMPT =
  'Return only JSON with status "proposed", a summary string, and exactly one update_component operation for componentId "smoke-hero". Its patch must contain only componentType "Hero" and title "Smoke checked". Do not return markdown, extra keys, code, HTML, or explanations.';

const SMOKE_CONFIG: BuilderData = {
  content: [
    {
      props: { id: 'smoke-hero', title: 'Smoke' },
      type: 'Hero',
    },
  ],
  root: { title: 'Smoke' },
};

type SmokeProvider = BuilderAiJsonTransportProviderDescriptor & {
  model: Parameters<typeof generateText>[0]['model'];
};
type SmokeResult = 'fail' | 'pass' | 'refused';

const PROVIDER_SMOKE_DEADLINE_MS = 5_000;
const WHOLE_SMOKE_DEADLINE_MS = 20_000;

export interface BuilderAiJsonTransportSmokeDependencies {
  combineSignals: (signals: AbortSignal[]) => AbortSignal;
  createDeadlineSignal: (milliseconds: number) => AbortSignal;
  environment: Record<string, string | undefined>;
  materializeProviders: (signal: AbortSignal) => Promise<SmokeProvider[]>;
  loadEnvironment: (options: {
    override: boolean;
    path: string;
    quiet: boolean;
  }) => { error?: unknown };
  now: () => number;
  runProvider: (provider: SmokeProvider, signal: AbortSignal) => Promise<boolean>;
  write: (line: string) => void;
}

function isApprovedEnvironmentSource(source: string | undefined): boolean {
  return Boolean(
    source &&
      (source.endsWith('/apps/web/.env') ||
        source.endsWith('/apps/web/.env.local'))
  );
}

function writeResult(
  write: (line: string) => void,
  provider: string,
  model: string,
  result: SmokeResult,
  latencyMs: number
): void {
  write(
    `provider=${provider} model=${model} result=${result} latencyMs=${latencyMs}`
  );
}

function refuse(dependencies: BuilderAiJsonTransportSmokeDependencies): number {
  writeResult(dependencies.write, 'none', 'none', 'refused', 0);
  return 1;
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
      SMOKE_CONFIG,
      parsed.data,
      (type) => `smoke-${type}`
    );
    return (
      result.warnings.length === 0 &&
      JSON.stringify(result.candidateConfig) ===
        JSON.stringify({
          ...SMOKE_CONFIG,
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
  provider: SmokeProvider,
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

export function createDefaultBuilderAiJsonTransportSmokeDependencies(): BuilderAiJsonTransportSmokeDependencies {
  return {
    combineSignals: AbortSignal.any,
    createDeadlineSignal: AbortSignal.timeout,
    environment: process.env,
    materializeProviders: async (_signal) => {
      const result = materializeBuilderAiProviderChain();
      return result.providers;
    },
    loadEnvironment: loadDotenv,
    now: Date.now,
    runProvider: runProviderSmoke,
    write: console.log,
  };
}

export async function verifyBuilderAiJsonTransport(
  dependencies: BuilderAiJsonTransportSmokeDependencies = createDefaultBuilderAiJsonTransportSmokeDependencies()
): Promise<number> {
  const source = dependencies.environment.BACI_WEB_ENV_SOURCE;
  if (
    dependencies.environment.BACI_APPROVE_PAID_AI_SMOKE !== '1' ||
    !isApprovedEnvironmentSource(source)
  ) {
    return refuse(dependencies);
  }

  try {
    const loaded = dependencies.loadEnvironment({
      override: false,
      path: source,
      quiet: true,
    });
    if (loaded.error) {
      return refuse(dependencies);
    }
  } catch {
    return refuse(dependencies);
  }
  const wholeSmokeSignal = dependencies.createDeadlineSignal(
    WHOLE_SMOKE_DEADLINE_MS
  );
  if (wholeSmokeSignal.aborted) return refuse(dependencies);

  let providers: SmokeProvider[];
  try {
    providers = await settleBuilderAiSmokeBeforeDeadline(
      dependencies.materializeProviders(wholeSmokeSignal),
      wholeSmokeSignal,
      WHOLE_SMOKE_DEADLINE_MS
    );
  } catch {
    return refuse(dependencies);
  }
  if (
    wholeSmokeSignal.aborted ||
    !builderAiJsonTransportContract.hasCanonicalProviderOrder(providers)
  ) {
    return refuse(dependencies);
  }

  let requiredProviderFailed = false;
  for (const provider of providers) {
    if (wholeSmokeSignal.aborted) {
      requiredProviderFailed = true;
      break;
    }
    const identity = builderAiJsonTransportContract.getProviderIdentity(
      provider.name
    );
    const startedAt = dependencies.now();
    const signal = dependencies.combineSignals([
      wholeSmokeSignal,
      dependencies.createDeadlineSignal(PROVIDER_SMOKE_DEADLINE_MS),
    ]);
    let passed = false;
    try {
      passed = await settleBuilderAiSmokeBeforeDeadline(
        dependencies.runProvider(provider, signal),
        signal,
        PROVIDER_SMOKE_DEADLINE_MS
      );
    } catch {
      passed = false;
    }
    writeResult(
      dependencies.write,
      identity.alias,
      identity.model,
      passed ? 'pass' : 'fail',
      Math.max(0, dependencies.now() - startedAt)
    );
    if (!passed || wholeSmokeSignal.aborted) requiredProviderFailed = true;
    if (wholeSmokeSignal.aborted) break;
  }

  return requiredProviderFailed ? 1 : 0;
}

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (entrypoint === import.meta.url) {
  verifyBuilderAiJsonTransport().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
