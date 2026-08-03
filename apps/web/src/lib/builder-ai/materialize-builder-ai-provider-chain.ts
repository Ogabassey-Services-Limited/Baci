import {
  type BuilderAiProvider,
  type BuilderAiProviderFactories,
  materializeBuilderAiProviders,
} from './builder-ai-provider-catalog';
import { builderAiProviderModelFactories } from './builder-ai-provider-model-factories';

export type BuilderAiProviderMaterialization =
  | { providers: BuilderAiProvider[] }
  | { code: 'ai_provider_unavailable'; providers: [] };

export function materializeBuilderAiProviderChain(
  environment: Partial<
    Pick<
      NodeJS.ProcessEnv,
      'CEREBRAS_API_KEY' | 'GROQ_API_KEY' | 'OPENROUTER_API_KEY'
    >
  > = {
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
  factories: BuilderAiProviderFactories = builderAiProviderModelFactories
): BuilderAiProviderMaterialization {
  const providers = materializeBuilderAiProviders(environment, factories);
  return providers.length > 0
    ? { providers }
    : { code: 'ai_provider_unavailable', providers: [] };
}
