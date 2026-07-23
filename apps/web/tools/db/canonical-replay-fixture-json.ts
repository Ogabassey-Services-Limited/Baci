import { canonicalJsonValue } from './canonical-json-value';

const unsafeStringPatterns = [
  /\bBearer\s+[^\s]{8,}/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.(?:[A-Za-z0-9_-]{10,}\b|(?![A-Za-z0-9_-]))/,
  /\bsbp_[A-Za-z0-9_-]{8,}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{8,}\b/,
  /postgres(?:ql)?:\/\/[^/\s:@]+:[^@\s/]+@/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{12,}\b/,
  /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{12,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
];

const semanticLogMarkers = [
  '→ applying:',
  '✓ applied:',
  '✓ already applied:',
  'Migrations summary:',
] as const;

const safeSemanticLogMarkers = new Set<string>(semanticLogMarkers);

function looksLikeRawLogLine(value: string): boolean {
  if (safeSemanticLogMarkers.has(value)) return false;
  return (
    semanticLogMarkers.some((marker) => value.includes(marker)) ||
    /^\[(?:runner|command|group|endgroup|debug|error|warning)\]\s/i.test(
      value
    ) ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+\S.+/.test(value)
  );
}

function assertSafeString(value: string): void {
  if (
    value.includes('\n') ||
    value.includes('\r') ||
    looksLikeRawLogLine(value) ||
    unsafeStringPatterns.some((pattern) => pattern.test(value))
  ) {
    throw new Error(
      'Canonical fixture contains secret, credential, or raw log material'
    );
  }
}

export function canonicalReplayFixtureJson(value: unknown): string {
  return canonicalJsonValue(value, { assertString: assertSafeString });
}
