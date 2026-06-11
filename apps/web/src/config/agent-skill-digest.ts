import { createHash } from 'node:crypto';
import { buildAgentSkillMarkdown } from '@/config/agent-readiness';

/**
 * Computes the sha256 hex digest of the agent skill markdown for a storefront
 * base URL. Pure read helper (node:crypto hash, no data mutation) — kept out
 * of the GET route handler body.
 */
export function buildAgentSkillDigest(baseUrl: string): string {
  return createHash('sha256')
    .update(buildAgentSkillMarkdown(baseUrl))
    .digest('hex');
}
