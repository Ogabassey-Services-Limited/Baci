// @vitest-environment node

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildAgentSkillMarkdown } from '@/config/agent-readiness';
import { buildAgentSkillDigest } from './agent-skill-digest';

describe('buildAgentSkillDigest', () => {
  it('returns the stable sha256 hex digest of the skill markdown', () => {
    const baseUrl = 'https://merchant.example.com';
    const expected = createHash('sha256')
      .update(buildAgentSkillMarkdown(baseUrl))
      .digest('hex');

    const digest = buildAgentSkillDigest(baseUrl);

    expect(digest).toBe(expected);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(buildAgentSkillDigest(baseUrl)).toBe(digest);
  });

  it('produces different digests for different storefront origins', () => {
    expect(buildAgentSkillDigest('https://a.example.com')).not.toBe(
      buildAgentSkillDigest('https://b.example.com')
    );
  });
});
