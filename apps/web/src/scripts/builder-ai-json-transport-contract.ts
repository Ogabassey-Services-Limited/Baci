export interface BuilderAiJsonTransportProviderDescriptor {
  name: string;
  opportunistic?: boolean;
}

const APPROVED_CEREBRAS_MODEL_NAME = 'gemma-4-31b';
const APPROVED_GROQ_MODEL_NAME = 'openai/gpt-oss-120b';
const PINNED_OPENROUTER_NAME = 'openrouter:google/gemma-4-31b-it:free';

function getProviderIdentity(name: string): { alias: string; model: string } {
  const separator = name.indexOf(':');
  if (separator < 1 || separator === name.length - 1) {
    return { alias: 'unknown', model: 'unknown' };
  }
  return { alias: name.slice(0, separator), model: name.slice(separator + 1) };
}

function hasApprovedModelIdentity(
  name: string,
  alias: string,
  model: string
): boolean {
  const identity = getProviderIdentity(name);
  return identity.alias === alias && identity.model === model;
}

function hasCanonicalProviderOrder(
  providers: BuilderAiJsonTransportProviderDescriptor[]
): boolean {
  let previous = -1;
  const approved = [
    ['cerebras', APPROVED_CEREBRAS_MODEL_NAME],
    ['groq', APPROVED_GROQ_MODEL_NAME],
    ['openrouter', PINNED_OPENROUTER_NAME.slice('openrouter:'.length)],
  ] as const;
  return (
    providers.length > 0 &&
    providers.every((provider) => {
      const identity = getProviderIdentity(provider.name);
      const index = approved.findIndex(
        ([alias, model]) => identity.alias === alias && identity.model === model
      );
      if (index < 0 || index <= previous) return false;
      previous = index;
      return index !== 2 || provider.opportunistic === true;
    })
  );
}

export const builderAiJsonTransportContract = {
  getProviderIdentity,
  hasCanonicalProviderOrder,
};
