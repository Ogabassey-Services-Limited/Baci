import { getQuizIntegrityTierOverridesJson } from '@/env';

export const QUIZ_INTEGRITY_TIER_RANKS = {
  basic: 1,
  device: 2,
  strong: 3,
} as const;

export type QuizIntegrityTier = keyof typeof QUIZ_INTEGRITY_TIER_RANKS;

function isQuizIntegrityTier(value: string): value is QuizIntegrityTier {
  return Object.hasOwn(QUIZ_INTEGRITY_TIER_RANKS, value);
}

function formatUnknownTierValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function normalizeQuizIntegrityTier(value: unknown): QuizIntegrityTier {
  if (value === null || value === undefined) {
    throw new Error(
      `unknown_quiz_integrity_tier:${formatUnknownTierValue(value)}`
    );
  }

  const normalized = String(value).trim().toLowerCase();
  if (isQuizIntegrityTier(normalized)) {
    return normalized;
  }

  throw new Error(
    `unknown_quiz_integrity_tier:${formatUnknownTierValue(value)}`
  );
}

export function getQuizIntegrityTierOverride(
  key: string,
  rawJson?: string
): QuizIntegrityTier | undefined {
  const resolvedJson =
    rawJson === undefined ? getQuizIntegrityTierOverridesJson() : rawJson;
  if (!resolvedJson?.trim()) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(resolvedJson);
  } catch {
    throw new Error('invalid_quiz_integrity_tier_overrides_json');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_quiz_integrity_tier_overrides_json');
  }

  const parsedObj = parsed as Record<string, unknown>;
  const rawOverride = parsedObj[key];
  if (rawOverride === undefined) return undefined;

  return normalizeQuizIntegrityTier(rawOverride);
}
