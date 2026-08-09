export const remediationObservationFor = (candidate) =>
  String(candidate?.lastSeen || candidate?.occurrences || 'observed');

export const remediationStateKeyFor = (candidate) =>
  String(candidate?.caseKey || candidate?.fingerprint || 'unknown');

export function matchingHandledEntry(handled, candidate) {
  const canonical = handled[remediationStateKeyFor(candidate)];
  const legacy = handled[String(candidate?.fingerprint || '')];
  const entry = canonical || legacy;
  return entry?.observation === remediationObservationFor(candidate)
    ? entry
    : null;
}
