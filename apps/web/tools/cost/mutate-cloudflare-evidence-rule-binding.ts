import { createHash } from 'node:crypto';

export const EVIDENCE_HOSTNAME = 'edge-evidence.ogabassey.com';

export type EvidenceRuleHeader = Readonly<{
  name: string;
  value: string;
}>;

/**
 * Provider read-back for the temporary rule created during qualification.
 *
 * A provider may return the complete reviewed fields, or (when its API does
 * not expose those fields) an independently sealed canonical hash. An
 * ID/name-only resource is never sufficient evidence.
 */
export type EvidenceTemporaryRuleBinding = Readonly<{
  id: string;
  expression?: string;
  action?: string;
  headers?: readonly EvidenceRuleHeader[];
  methods?: readonly string[];
  threshold?: number | null;
  canonicalSha256?: string;
}>;

type EvidenceTemporaryRuleFields = Readonly<{
  id: string;
  expression: string;
  action: string;
  headers: readonly EvidenceRuleHeader[];
  methods: readonly string[];
  threshold: number | null;
}>;

const HASH_PATTERN = /^[a-f0-9]{64}$/;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0))
      throw new Error(
        'temporary rule canonical fields contain an invalid number'
      );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value !== 'object' || !value)
    throw new Error('temporary rule canonical fields are invalid');
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function fieldsForCanonicalHash(binding: EvidenceTemporaryRuleFields) {
  return {
    id: binding.id,
    expression: binding.expression,
    action: binding.action,
    headers: binding.headers,
    methods: binding.methods,
    threshold: binding.threshold,
  };
}

export function calculateEvidenceTemporaryRuleCanonicalSha256(
  binding: EvidenceTemporaryRuleFields
) {
  return createHash('sha256')
    .update(canonicalJson(fieldsForCanonicalHash(binding)))
    .digest('hex');
}

const reviewedHeaders = Object.freeze([
  Object.freeze({ name: 'X-Baci-Evidence-Probe', value: '1' }),
  Object.freeze({ name: 'X-Baci-Evidence-Run', value: 'run-scoped' }),
]);
const reviewedTemporaryRuleFields = Object.freeze({
  id: 'baci-evidence-temporary-rule',
  expression: `http.host eq "${EVIDENCE_HOSTNAME}"`,
  action: 'block',
  headers: reviewedHeaders,
  methods: Object.freeze(['GET', 'HEAD']),
  threshold: 100,
});

/** Exact rule contract reviewed for the isolated evidence mutation. */
export const REVIEWED_TEMPORARY_RULE_BINDING = Object.freeze({
  ...reviewedTemporaryRuleFields,
  canonicalSha256: calculateEvidenceTemporaryRuleCanonicalSha256(
    reviewedTemporaryRuleFields
  ),
});

function validateTemporaryRuleFields(
  binding: EvidenceTemporaryRuleBinding
): EvidenceTemporaryRuleFields | null {
  if (!binding || typeof binding !== 'object') return null;
  if (
    Object.keys(binding).some(
      (key) =>
        ![
          'id',
          'expression',
          'action',
          'headers',
          'methods',
          'threshold',
          'canonicalSha256',
        ].includes(key)
    )
  )
    return null;
  const { id, expression, action, headers, methods, threshold } = binding;
  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    typeof expression !== 'string' ||
    expression.trim().length === 0 ||
    typeof action !== 'string' ||
    action.trim().length === 0 ||
    !Array.isArray(headers) ||
    !Array.isArray(methods) ||
    methods.length === 0 ||
    (typeof threshold !== 'number' && threshold !== null) ||
    (typeof threshold === 'number' &&
      (!Number.isFinite(threshold) || threshold < 0))
  )
    return null;
  const normalizedHeaders: EvidenceRuleHeader[] = [];
  for (const header of headers) {
    if (
      !header ||
      typeof header !== 'object' ||
      typeof header.name !== 'string' ||
      header.name.trim().length === 0 ||
      typeof header.value !== 'string' ||
      header.value.length === 0 ||
      Object.keys(header).some((key) => !['name', 'value'].includes(key))
    )
      return null;
    normalizedHeaders.push({ name: header.name, value: header.value });
  }
  if (
    new Set(normalizedHeaders.map((header) => header.name.toLowerCase()))
      .size !== normalizedHeaders.length
  )
    return null;
  if (
    methods.some(
      (method) => typeof method !== 'string' || method.trim().length === 0
    ) ||
    new Set(methods).size !== methods.length
  )
    return null;
  return {
    id,
    expression,
    action,
    headers: normalizedHeaders,
    methods: [...methods],
    threshold,
  };
}

/**
 * Binds provider rule read-back to the one reviewed temporary-rule contract.
 * Complete fields are compared and, when present, their canonical hash is
 * recomputed; hash-only read-back must match the independently reviewed hash.
 */
export function verifyTemporaryRule(
  actual: EvidenceTemporaryRuleBinding,
  expected: EvidenceTemporaryRuleBinding = REVIEWED_TEMPORARY_RULE_BINDING
) {
  const expectedFields = validateTemporaryRuleFields(expected);
  const actualFields = validateTemporaryRuleFields(actual);
  if (!expectedFields && !HASH_PATTERN.test(expected.canonicalSha256 ?? ''))
    throw new Error('reviewed temporary rule binding is invalid');
  if (!actualFields && !HASH_PATTERN.test(actual?.canonicalSha256 ?? ''))
    throw new Error('provider temporary rule read-back is missing its binding');
  if (actual.id !== expected.id)
    throw new Error(
      'provider temporary rule ID does not match reviewed binding'
    );
  const expectedHash = expectedFields
    ? calculateEvidenceTemporaryRuleCanonicalSha256(expectedFields)
    : expected.canonicalSha256;
  const actualHash = actualFields
    ? calculateEvidenceTemporaryRuleCanonicalSha256(actualFields)
    : actual.canonicalSha256;
  if (
    !expectedHash ||
    !actualHash ||
    !HASH_PATTERN.test(expectedHash) ||
    !HASH_PATTERN.test(actualHash) ||
    actualHash !== expectedHash ||
    (expected.canonicalSha256 !== undefined &&
      expected.canonicalSha256 !== expectedHash) ||
    (actual.canonicalSha256 !== undefined &&
      actual.canonicalSha256 !== actualHash)
  )
    throw new Error(
      'provider temporary rule fields do not match the reviewed binding'
    );
  return true;
}
