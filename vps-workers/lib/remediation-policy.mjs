const PROTECTED_PATH_PATTERNS = [
  /^apps\/web\/src\/proxy\.ts$/,
  /^apps\/web\/src\/app\/api\/payments\//,
  /^apps\/web\/src\/app\/api\/.*webhook/,
  /^apps\/web\/src\/app\/api\/auth\//,
  /^apps\/web\/src\/lib\/payments\//,
  /^supabase\/migrations\//,
  /^\.github\/workflows\//,
  /^\.env/,
  /(^|\/)secrets?\./,
];

export function isProtectedPath(path) {
  const normalized = String(path || '').replace(/\\/g, '/');
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function evaluateMergePolicy({
  changedFiles = [],
  checksPassed = false,
  hasHighSeverityReview = false,
  hasUnresolvedThreads = false,
} = {}) {
  const reasons = [];
  const protectedFiles = changedFiles.filter((path) => isProtectedPath(path));

  if (!checksPassed) {
    reasons.push('required checks have not passed');
  }
  if (hasUnresolvedThreads) {
    reasons.push('review threads are unresolved');
  }
  if (hasHighSeverityReview) {
    reasons.push('high severity review findings are present');
  }
  if (protectedFiles.length > 0) {
    reasons.push(`protected path touched: ${protectedFiles.join(', ')}`);
  }

  return { allowed: reasons.length === 0, reasons };
}

export function buildCodexRemediationPrompt({ candidate }) {
  const sample = candidate.sample || {};
  return `You are Codex working in the Baci repository.

Production Vercel error evidence:
- fingerprint: ${candidate.fingerprint}
- occurrences: ${candidate.occurrences}
- firstSeen: ${candidate.firstSeen}
- lastSeen: ${candidate.lastSeen}
- route: ${sample.route || '(unknown)'}
- deploymentId: ${sample.deploymentId || '(unknown)'}
- requestId: ${sample.requestId || '(unknown)'}
- message: ${sample.message || '(empty)'}

Task:
1. Reproduce or trace the failure from the evidence.
2. Write or update regression tests first.
3. Make the smallest production fix that addresses the root cause.
4. Run focused tests, then wider repo gates if the change crosses shared code.
5. Create a pull request with the Vercel evidence and validation output.

Safety boundaries:
- Do not modify protected files: proxy.ts, payment routes, webhook routes, auth routes, existing migrations, GitHub workflows, or secrets.
- Do not merge the PR directly.
- If a protected file is required, stop and write a report explaining why.
- If the issue cannot be reproduced or fixed safely, stop and write a report.
`;
}
