import type { EvidenceRuleHeader } from './mutate-cloudflare-evidence-rule-binding';
import {
  createReviewedTemporaryRuleBinding,
  EVIDENCE_HOSTNAME,
  EVIDENCE_RUN_NONCE_PATTERN,
} from './mutate-cloudflare-evidence-rule-binding';

export const SYNTHETIC_PATHS = [
  '/__baci-evidence/a',
  '/__baci-evidence/b',
] as const;

export type EvidenceProbeResult = Readonly<{
  id: string;
  succeeded: boolean;
  hostname: string;
  method: 'GET' | 'HEAD';
  path: string;
  headers: readonly EvidenceRuleHeader[];
}>;

/** The bounded matrix is the only probe set that may enter the run journal. */
export const REVIEWED_EVIDENCE_PROBE_MATRIX = Object.freeze(
  SYNTHETIC_PATHS.map((path) => Object.freeze({ method: 'GET' as const, path }))
);

/** Stable journal identifiers for the reviewed probe cases. */
export const REVIEWED_PROBE_CASE_IDS = Object.freeze(
  REVIEWED_EVIDENCE_PROBE_MATRIX.map(({ method, path }) => `${method} ${path}`)
);

function sameHeaders(
  actual: EvidenceProbeResult['headers'],
  expected: EvidenceProbeResult['headers']
) {
  return (
    actual.length === expected.length &&
    actual.every(
      (header, index) =>
        header &&
        typeof header === 'object' &&
        Object.keys(header).every((key) => key === 'name' || key === 'value') &&
        typeof header.name === 'string' &&
        typeof header.value === 'string' &&
        header.name === expected[index]?.name &&
        header.value === expected[index]?.value
    )
  );
}

/**
 * Binds provider probe receipts to the exact reviewed path/method/header
 * matrix. Provider IDs remain opaque receipts; the journal receives only the
 * deterministic case IDs exported above and cannot be selected by a provider.
 */
export function validateEvidenceProbeResults(
  runId: string,
  probes: readonly EvidenceProbeResult[]
) {
  if (!EVIDENCE_RUN_NONCE_PATTERN.test(runId))
    throw new Error('evidence probe run nonce is invalid');
  if (probes.length !== REVIEWED_EVIDENCE_PROBE_MATRIX.length)
    throw new Error('evidence probe matrix is incomplete');
  const binding = createReviewedTemporaryRuleBinding(runId);
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  for (const probe of probes) {
    if (
      !probe ||
      typeof probe.id !== 'string' ||
      probe.id.length === 0 ||
      seenIds.has(probe.id)
    )
      throw new Error('evidence probe IDs must be nonempty and unique');
    seenIds.add(probe.id);
    if (probe.succeeded !== true)
      throw new Error('synthetic probe did not complete');
    if (
      probe.hostname !== EVIDENCE_HOSTNAME ||
      probe.method !== 'GET' ||
      !REVIEWED_EVIDENCE_PROBE_MATRIX.some(
        (expected) =>
          expected.method === probe.method && expected.path === probe.path
      ) ||
      seenPaths.has(probe.path) ||
      !Array.isArray(probe.headers) ||
      !sameHeaders(probe.headers, binding.headers)
    )
      throw new Error('evidence probe does not match the reviewed matrix');
    seenPaths.add(probe.path);
  }
  if (
    seenPaths.size !== REVIEWED_EVIDENCE_PROBE_MATRIX.length ||
    REVIEWED_EVIDENCE_PROBE_MATRIX.some(({ path }) => !seenPaths.has(path))
  )
    throw new Error('evidence probe matrix is incomplete');
  return REVIEWED_PROBE_CASE_IDS;
}
