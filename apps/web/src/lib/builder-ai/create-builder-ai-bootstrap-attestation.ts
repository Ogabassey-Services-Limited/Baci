import { randomBytes } from 'node:crypto';
import {
  BUILDER_AI_CEREBRAS_MODEL,
  BUILDER_AI_GROQ_MODEL,
  type BuilderAiProviderEnvironment,
} from './builder-ai-provider-catalog';
import { createBuilderAiProviderBindingTag } from './create-builder-ai-provider-binding-tag';
import type { BuilderAiAttestationEnvironment } from './vercel-builder-ai-bootstrap';

const deploymentTier = 'provider-tier-unverified';
const CEREBRAS_ACCOUNT_REF = 'deployment:baci-production:cerebras';
const GROQ_ACCOUNT_REF = 'deployment:baci-production:groq';

type Environment = Readonly<Record<string, string | undefined>>;

function configured(value: string | undefined): string | null {
  return value?.trim() || null;
}

/** Creates the immutable, deployment-scoped Builder attestation payload. */
export function createBuilderAiBootstrapAttestation(
  environment: Environment = process.env,
  now = new Date()
): {
  environment: BuilderAiProviderEnvironment;
  values: BuilderAiAttestationEnvironment;
} | null {
  const cerebrasKey = configured(environment.CEREBRAS_API_KEY);
  const groqKey = configured(environment.GROQ_API_KEY);
  if (!cerebrasKey || !groqKey) return null;
  const releaseAttestedAt = now.toISOString();
  const pepper = randomBytes(32).toString('base64url');
  const cerebras = {
    accountRef: CEREBRAS_ACCOUNT_REF,
    approvedModel: BUILDER_AI_CEREBRAS_MODEL,
    deploymentTier,
    key: cerebrasKey,
    providerName: 'cerebras',
    releaseAttestedAt,
  };
  const groq = {
    accountRef: GROQ_ACCOUNT_REF,
    approvedModel: BUILDER_AI_GROQ_MODEL,
    deploymentTier,
    key: groqKey,
    providerName: 'groq',
    releaseAttestedAt,
  };
  const cerebrasTag = createBuilderAiProviderBindingTag(cerebras, pepper);
  const groqTag = createBuilderAiProviderBindingTag(groq, pepper);
  if (!cerebrasTag || !groqTag) return null;
  const values = {
    BUILDER_AI_PROVIDER_BINDING_PEPPER: pepper,
    CEREBRAS_BUILDER_ACCOUNT_REF: cerebras.accountRef,
    CEREBRAS_BUILDER_APPROVED_MODEL: cerebras.approvedModel,
    CEREBRAS_BUILDER_CREDENTIAL_BINDING_TAG: cerebrasTag,
    CEREBRAS_BUILDER_DEPLOYMENT_TIER: cerebras.deploymentTier,
    CEREBRAS_BUILDER_RELEASE_ATTESTED_AT: releaseAttestedAt,
    GROQ_BUILDER_ACCOUNT_REF: groq.accountRef,
    GROQ_BUILDER_APPROVED_MODEL: groq.approvedModel,
    GROQ_BUILDER_CREDENTIAL_BINDING_TAG: groqTag,
    GROQ_BUILDER_DEPLOYMENT_TIER: groq.deploymentTier,
    GROQ_BUILDER_RELEASE_ATTESTED_AT: releaseAttestedAt,
  };
  return {
    environment: {
      ...environment,
      ...values,
      CEREBRAS_API_KEY: cerebrasKey,
      GROQ_API_KEY: groqKey,
    },
    values,
  };
}
