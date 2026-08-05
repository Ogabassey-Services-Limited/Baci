export type QuizRulesVersionMetadata = Readonly<{
  approvedForLive: boolean;
  availableInTest: boolean;
  effectiveAt: string;
  label: string;
  version: string;
}>;

const initialRulesVersion: QuizRulesVersionMetadata = Object.freeze({
  approvedForLive: false,
  availableInTest: true,
  effectiveAt: '2026-08-04T00:00:00.000Z',
  label: 'Quiz rules draft for private test events',
  version: 'test-v1',
});

const liveFreeSkillRulesVersion: QuizRulesVersionMetadata = Object.freeze({
  approvedForLive: true,
  availableInTest: false,
  effectiveAt: '2026-08-05T00:00:00.000Z',
  label: 'Free-entry deterministic skill competition rules',
  version: 'live-v1',
});

/**
 * Immutable registry used by launch validation. Legal text is added separately;
 * the initial draft deliberately permits test events only.
 */
export const QUIZ_RULES_VERSION_REGISTRY: Readonly<
  Record<string, QuizRulesVersionMetadata>
> = Object.freeze({
  [initialRulesVersion.version]: initialRulesVersion,
  [liveFreeSkillRulesVersion.version]: liveFreeSkillRulesVersion,
});

export function getQuizRulesVersion(
  version: string
): QuizRulesVersionMetadata | undefined {
  return QUIZ_RULES_VERSION_REGISTRY[version];
}

export function isQuizRulesVersionApprovedForLive(version: string): boolean {
  return getQuizRulesVersion(version)?.approvedForLive === true;
}
