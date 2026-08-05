import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LanguageModel } from 'ai';

export const BUILDER_AI_CEREBRAS_MODEL = 'gemma-4-31b';
export const BUILDER_AI_GROQ_MODEL = 'openai/gpt-oss-120b';
export const BUILDER_AI_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';

const ATTESTATION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const OPENROUTER_APPROVAL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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

export interface BuilderAiProviderEnvironment {
  CEREBRAS_API_KEY?: string;
  CEREBRAS_BUILDER_ACCOUNT_REF?: string;
  CEREBRAS_BUILDER_CREDENTIAL_BINDING_TAG?: string;
  CEREBRAS_BUILDER_DEPLOYMENT_TIER?: string;
  CEREBRAS_BUILDER_APPROVED_MODEL?: string;
  CEREBRAS_BUILDER_RELEASE_ATTESTED_AT?: string;
  GROQ_API_KEY?: string;
  GROQ_BUILDER_ACCOUNT_REF?: string;
  GROQ_BUILDER_CREDENTIAL_BINDING_TAG?: string;
  GROQ_BUILDER_DEPLOYMENT_TIER?: string;
  GROQ_BUILDER_APPROVED_MODEL?: string;
  GROQ_BUILDER_RELEASE_ATTESTED_AT?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BUILDER_TRANSPORT_APPROVED_AT?: string;
  OPENROUTER_BUILDER_TRANSPORT_APPROVED_MODEL?: string;
  BUILDER_AI_PROVIDER_BINDING_PEPPER?: string;
}

export type BuilderAiMaterializationPurpose = 'runtime' | 'smoke';

function configured(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasFreshIsoTimestamp(
  value: string | undefined,
  now: number,
  maximumAgeMs: number
): boolean {
  const parsed = Date.parse(value ?? '');
  return (
    Number.isFinite(parsed) && parsed <= now && now - parsed <= maximumAgeMs
  );
}

function hasReliableAttestation(
  providerName: string,
  key: string | null,
  accountRef: string | null,
  credentialBindingTag: string | null,
  bindingPepper: string | null,
  deploymentTier: string | null,
  approvedModel: string | null,
  expectedModel: string,
  releaseAttestedAt: string | undefined,
  now: number
): boolean {
  if (
    !key ||
    !accountRef ||
    !credentialBindingTag ||
    !bindingPepper ||
    !deploymentTier ||
    approvedModel !== expectedModel
  ) {
    return false;
  }
  const expectedTag = createHmac('sha256', bindingPepper)
    .update(`baci-builder-ai-provider-binding:v1:${providerName}:${key}`)
    .digest('hex');
  const suppliedTag = credentialBindingTag.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(suppliedTag)) return false;
  const bindingMatches = timingSafeEqual(
    Buffer.from(expectedTag, 'hex'),
    Buffer.from(suppliedTag, 'hex')
  );
  // No offline SDK/API metadata proves account ownership or tier. The
  // non-secret deployment record is therefore a release attestation, bound to
  // the configured credential with a domain-separated HMAC tag. A mismatch
  // fails closed; provider account/tier truth requires separate dated
  // management-plane evidence and is deliberately not claimed here.
  return Boolean(
    bindingMatches &&
      hasFreshIsoTimestamp(releaseAttestedAt, now, ATTESTATION_MAX_AGE_MS)
  );
}

export function materializeBuilderAiProviders(
  environment: BuilderAiProviderEnvironment,
  factories: BuilderAiProviderFactories,
  options: { now?: number; purpose?: BuilderAiMaterializationPurpose } = {}
): BuilderAiProvider[] {
  const now = options.now ?? Date.now();
  const purpose = options.purpose ?? 'runtime';
  const cerebrasKey = configured(environment.CEREBRAS_API_KEY);
  const groqKey = configured(environment.GROQ_API_KEY);
  const bindingPepper = configured(
    environment.BUILDER_AI_PROVIDER_BINDING_PEPPER
  );
  const cerebrasApproved = hasReliableAttestation(
    'cerebras',
    cerebrasKey,
    configured(environment.CEREBRAS_BUILDER_ACCOUNT_REF),
    configured(environment.CEREBRAS_BUILDER_CREDENTIAL_BINDING_TAG),
    bindingPepper,
    configured(environment.CEREBRAS_BUILDER_DEPLOYMENT_TIER),
    configured(environment.CEREBRAS_BUILDER_APPROVED_MODEL),
    BUILDER_AI_CEREBRAS_MODEL,
    environment.CEREBRAS_BUILDER_RELEASE_ATTESTED_AT,
    now
  );
  const groqApproved = hasReliableAttestation(
    'groq',
    groqKey,
    configured(environment.GROQ_BUILDER_ACCOUNT_REF),
    configured(environment.GROQ_BUILDER_CREDENTIAL_BINDING_TAG),
    bindingPepper,
    configured(environment.GROQ_BUILDER_DEPLOYMENT_TIER),
    configured(environment.GROQ_BUILDER_APPROVED_MODEL),
    BUILDER_AI_GROQ_MODEL,
    environment.GROQ_BUILDER_RELEASE_ATTESTED_AT,
    now
  );

  // Reliable Builder links are an all-or-nothing release gate. This prevents
  // a silent partial rollout when a credential, account binding, or tier proof
  // disappears from the configured environment.
  if (!cerebrasApproved || !groqApproved) return [];

  const providers: BuilderAiProvider[] = [
    {
      model: factories.createCerebrasModel(cerebrasKey as string),
      name: `cerebras:${BUILDER_AI_CEREBRAS_MODEL}`,
    },
    {
      model: factories.createGroqModel(groqKey as string),
      name: `groq:${BUILDER_AI_GROQ_MODEL}`,
    },
  ];
  const openRouterKey = configured(environment.OPENROUTER_API_KEY);
  const exactRuntimeApproval =
    environment.OPENROUTER_BUILDER_TRANSPORT_APPROVED_MODEL ===
      BUILDER_AI_OPENROUTER_MODEL &&
    hasFreshIsoTimestamp(
      environment.OPENROUTER_BUILDER_TRANSPORT_APPROVED_AT,
      now,
      OPENROUTER_APPROVAL_MAX_AGE_MS
    );
  if (openRouterKey && (purpose === 'smoke' || exactRuntimeApproval)) {
    providers.push({
      model: factories.createOpenRouterModel(openRouterKey),
      name: `openrouter:${BUILDER_AI_OPENROUTER_MODEL}`,
      opportunistic: true,
    });
  }
  return providers;
}

export function hasCanonicalBuilderAiProviderOrder(
  providers: Pick<BuilderAiProvider, 'name' | 'opportunistic'>[]
): boolean {
  const names = providers.map(({ name }) => name);
  const reliable = [
    `cerebras:${BUILDER_AI_CEREBRAS_MODEL}`,
    `groq:${BUILDER_AI_GROQ_MODEL}`,
  ];
  if (!reliable.every((name, index) => names[index] === name)) return false;
  return (
    providers.length === 2 ||
    (providers.length === 3 &&
      providers[2]?.name === `openrouter:${BUILDER_AI_OPENROUTER_MODEL}` &&
      providers[2]?.opportunistic === true)
  );
}
