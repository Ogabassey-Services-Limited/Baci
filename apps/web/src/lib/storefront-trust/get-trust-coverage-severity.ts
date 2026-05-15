import type { AgentCommerceTrustSeverity } from './build-agent-commerce-trust-readiness';

export function getTrustCoverageSeverity(
  covered: number,
  total: number
): AgentCommerceTrustSeverity {
  if (total === 0) return 'warn';
  if (covered === 0) return 'fail';
  return covered === total ? 'pass' : 'warn';
}
