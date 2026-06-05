const STATE_ALIAS_GROUPS = [
  ['FCT - Abuja', 'Federal Capital Territory', 'FCT', 'Abuja'],
] as const;

function normalizeStateText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function getLocationStateAliasCandidates(state: string): string[] {
  const trimmed = state.trim();
  const normalized = normalizeStateText(trimmed);
  const withoutStateSuffix = normalized.replace(/\s+state$/, '');

  for (const group of STATE_ALIAS_GROUPS) {
    const normalizedGroup = group.map(normalizeStateText);
    if (
      normalizedGroup.includes(normalized) ||
      normalizedGroup.includes(withoutStateSuffix)
    ) {
      return unique([trimmed, ...group]);
    }
  }

  return unique([
    trimmed,
    withoutStateSuffix === normalized ? '' : withoutStateSuffix,
  ]);
}

export function resolveLocationStateLabel(
  state: string,
  knownStates: readonly string[]
): string {
  const trimmed = state.trim();
  if (!trimmed) return '';

  const exactMatch = knownStates.find((known) => known === trimmed);
  if (exactMatch) return exactMatch;

  const normalizedKnown = knownStates.map((known) => ({
    label: known,
    normalized: normalizeStateText(known),
  }));
  const normalizedInput = normalizeStateText(trimmed);

  const caseInsensitiveMatch = normalizedKnown.find(
    (known) => known.normalized === normalizedInput
  );
  if (caseInsensitiveMatch) return caseInsensitiveMatch.label;

  const aliasCandidates =
    getLocationStateAliasCandidates(trimmed).map(normalizeStateText);
  const aliasMatch = normalizedKnown.find((known) =>
    aliasCandidates.includes(known.normalized)
  );
  if (aliasMatch) return aliasMatch.label;

  return trimmed;
}

export function areLocationStateLabelsEquivalent(
  stateA: string,
  stateB: string
): boolean {
  const aliasesA =
    getLocationStateAliasCandidates(stateA).map(normalizeStateText);
  const aliasesB =
    getLocationStateAliasCandidates(stateB).map(normalizeStateText);

  return aliasesA.some((alias) => aliasesB.includes(alias));
}
