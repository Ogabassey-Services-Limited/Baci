import { describe, expect, it } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal';
import {
  mutationCapability,
  mutationInput,
} from './mutate-cloudflare-evidence-test-fixtures';
import {
  parseMutationArguments,
  verifyCapability,
  verifyResource,
} from './mutate-cloudflare-evidence-validation';

const runId = '0123456789abcdef0123456789abcdef';
const journal = {
  runId,
  accountId: 'account',
  zoneId: 'zone',
  writeTokenId: mutationInput.writeTokenId,
  readTokenId: mutationInput.readTokenId,
  policySha256: mutationInput.policySha256,
  cleanupPolicySha256: mutationInput.cleanupPolicySha256,
} as CloudflareEvidenceRunJournal;
const resource = {
  id: 'resource-1',
  name: `baci-evidence-${runId}`,
  description: `baci evidence ${runId}`,
  accountId: 'account',
  zoneId: 'zone',
  hostname: 'edge-evidence.ogabassey.com',
  paths: ['/__baci-evidence/a', '/__baci-evidence/b'],
};

describe('mutation validation helpers', () => {
  it('accepts only the bounded run forms and exact resource description', () => {
    expect(parseMutationArguments(['--run', runId, '--apply'])).toEqual({
      mode: 'apply',
      runId,
    });
    expect(() =>
      parseMutationArguments(['--run', 'run-short', '--apply'])
    ).toThrow('mutation accepts');
    expect(() =>
      verifyResource(resource, journal, resource.name)
    ).not.toThrow();
  });

  it('rejects descriptions that merely contain the run ID', () => {
    expect(() =>
      verifyResource(
        { ...resource, description: `${resource.description} extra` },
        journal,
        resource.name
      )
    ).toThrow('provider read-back');
  });

  it('accepts a cleanup replacement only with its separately approved policy hash', () => {
    expect(() =>
      verifyCapability(mutationCapability, journal, 'apply')
    ).not.toThrow();

    const replacement = {
      ...mutationCapability,
      tokenId: 'replacement-write',
      policySha256: mutationInput.cleanupPolicySha256,
      replacementForTokenId: mutationInput.writeTokenId,
      cleanupOnly: true as const,
    };
    expect(() =>
      verifyCapability(replacement, journal, 'cleanup')
    ).not.toThrow();
  });

  it('rejects a cleanup replacement with a missing or unapproved policy hash', () => {
    const replacement = {
      ...mutationCapability,
      tokenId: 'replacement-write',
      replacementForTokenId: mutationInput.writeTokenId,
      cleanupOnly: true as const,
    };
    expect(() => verifyCapability(replacement, journal, 'cleanup')).toThrow(
      'journaled authority'
    );
    expect(() =>
      verifyCapability(
        { ...replacement, policySha256: 'e'.repeat(64) },
        journal,
        'cleanup'
      )
    ).toThrow('journaled authority');
    expect(() =>
      verifyCapability(
        { ...replacement, policySha256: mutationInput.cleanupPolicySha256 },
        { ...journal, cleanupPolicySha256: undefined },
        'cleanup'
      )
    ).toThrow('journaled authority');
  });
});
