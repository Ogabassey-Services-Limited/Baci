import type { LanguageModel } from 'ai';

export const BUILDER_AI_CEREBRAS_MODEL = 'gemma-4-31b';
export const BUILDER_AI_GROQ_MODEL = 'openai/gpt-oss-120b';
export const BUILDER_AI_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';

export interface BuilderAiProvider {
  model: LanguageModel;
  name: string;
  opportunistic?: boolean;
}

export interface BuilderAiProviderFactories {
  createCerebrasModel: (apiKey: string) => LanguageModel;
  createGroqModel: (apiKey: string) => LanguageModel;
  createOpenRouterModel: (apiKey: string) => LanguageModel;
}

function configuredKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function materializeBuilderAiProviders(
  environment: Partial<
    Pick<
      NodeJS.ProcessEnv,
      'CEREBRAS_API_KEY' | 'GROQ_API_KEY' | 'OPENROUTER_API_KEY'
    >
  >,
  factories: BuilderAiProviderFactories
): BuilderAiProvider[] {
  const providers: BuilderAiProvider[] = [];
  const cerebrasKey = configuredKey(environment.CEREBRAS_API_KEY);
  if (cerebrasKey) {
    providers.push({
      model: factories.createCerebrasModel(cerebrasKey),
      name: `cerebras:${BUILDER_AI_CEREBRAS_MODEL}`,
    });
  }
  const groqKey = configuredKey(environment.GROQ_API_KEY);
  if (groqKey) {
    providers.push({
      model: factories.createGroqModel(groqKey),
      name: `groq:${BUILDER_AI_GROQ_MODEL}`,
    });
  }
  const openRouterKey = configuredKey(environment.OPENROUTER_API_KEY);
  if (openRouterKey) {
    providers.push({
      model: factories.createOpenRouterModel(openRouterKey),
      name: `openrouter:${BUILDER_AI_OPENROUTER_MODEL}`,
      opportunistic: true,
    });
  }
  return providers;
}
