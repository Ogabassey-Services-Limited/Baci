import type { TextProvider } from './text-provider-chain';
import { getTextProviderChain } from './text-provider-chain';

// Compatibility alias for the AI-copilot (builder) route. The chain shipped
// here in PR #2978 was promoted to the platform-wide text chain in
// ./text-provider-chain — same order, same env gating, same provider
// construction — when every other text AI surface adopted it. Builder code
// keeps importing from this module so the high-risk builder path needed no
// churn.
export type CopilotTextProvider = TextProvider;

export const getCopilotTextProviderChain = getTextProviderChain;
