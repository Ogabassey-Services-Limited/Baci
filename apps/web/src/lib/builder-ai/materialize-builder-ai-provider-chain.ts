import {
  type BuilderAiMaterializationPurpose,
  type BuilderAiProvider,
  type BuilderAiProviderEnvironment,
  type BuilderAiProviderFactories,
  materializeBuilderAiProviders,
} from './builder-ai-provider-catalog';
import { builderAiProviderModelFactories } from './builder-ai-provider-model-factories';

export type BuilderAiProviderMaterialization =
  | { providers: BuilderAiProvider[] }
  | { code: 'ai_provider_unavailable'; providers: [] };

function runtimeEnvironment(): BuilderAiProviderEnvironment {
  return {
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    CEREBRAS_BUILDER_ACCOUNT_REF: process.env.CEREBRAS_BUILDER_ACCOUNT_REF,
    CEREBRAS_BUILDER_TIER_ATTESTED_AT:
      process.env.CEREBRAS_BUILDER_TIER_ATTESTED_AT,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_BUILDER_ACCOUNT_REF: process.env.GROQ_BUILDER_ACCOUNT_REF,
    GROQ_BUILDER_TIER_ATTESTED_AT: process.env.GROQ_BUILDER_TIER_ATTESTED_AT,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BUILDER_TRANSPORT_APPROVED_AT:
      process.env.OPENROUTER_BUILDER_TRANSPORT_APPROVED_AT,
    OPENROUTER_BUILDER_TRANSPORT_APPROVED_MODEL:
      process.env.OPENROUTER_BUILDER_TRANSPORT_APPROVED_MODEL,
  };
}

export function materializeBuilderAiProviderChain(
  environment: BuilderAiProviderEnvironment = runtimeEnvironment(),
  factories: BuilderAiProviderFactories = builderAiProviderModelFactories,
  purpose: BuilderAiMaterializationPurpose = 'runtime'
): BuilderAiProviderMaterialization {
  const providers = materializeBuilderAiProviders(environment, factories, {
    purpose,
  });
  return providers.length > 0
    ? { providers }
    : { code: 'ai_provider_unavailable', providers: [] };
}
