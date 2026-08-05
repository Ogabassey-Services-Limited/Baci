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
  CEREBRAS_BUILDER_TIER_ATTESTED_AT?: string;
  GROQ_API_KEY?: string;
  GROQ_BUILDER_ACCOUNT_REF?: string;
  GROQ_BUILDER_TIER_ATTESTED_AT?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BUILDER_TRANSPORT_APPROVED_AT?: string;
  OPENROUTER_BUILDER_TRANSPORT_APPROVED_MODEL?: string;
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
  key: string | null,
  accountRef: string | null,
  attestedAt: string | undefined,
  now: number
): boolean {
  // The account reference is intentionally non-secret and is bound to the
  // credential-bearing deployment configuration out-of-band. A key without it
  // is never enough to turn on a billed provider.
  return Boolean(
    key &&
      accountRef &&
      hasFreshIsoTimestamp(attestedAt, now, ATTESTATION_MAX_AGE_MS)
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
  const cerebrasApproved = hasReliableAttestation(
    cerebrasKey,
    configured(environment.CEREBRAS_BUILDER_ACCOUNT_REF),
    environment.CEREBRAS_BUILDER_TIER_ATTESTED_AT,
    now
  );
  const groqApproved = hasReliableAttestation(
    groqKey,
    configured(environment.GROQ_BUILDER_ACCOUNT_REF),
    environment.GROQ_BUILDER_TIER_ATTESTED_AT,
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
