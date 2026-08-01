import { describe, expect, it } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal';
import {
  mutationCapability,
  mutationInput,
} from './mutate-cloudflare-evidence-test-fixtures';
import {
  parseMutationArguments,
  REVIEWED_TEMPORARY_RULE_BINDING,
  verifyCapability,
  verifyResource,
  verifyTemporaryRule,
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
  temporaryRule: REVIEWED_TEMPORARY_RULE_BINDING,
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

  it('rejects a provider rule with a broader method set', () => {
    expect(() =>
      verifyResource(
        {
          ...resource,
          temporaryRule: {
            ...resource.temporaryRule,
            methods: ['GET', 'HEAD', 'POST'],
          },
        },
        journal,
        resource.name
      )
    ).toThrow('temporary rule fields');
  });

  it('rejects a provider rule with a changed header predicate', () => {
    expect(() =>
      verifyResource(
        {
          ...resource,
          temporaryRule: {
            ...resource.temporaryRule,
            headers: resource.temporaryRule.headers?.map((header, index) =>
              index === 0 ? { ...header, value: '2' } : header
            ),
          },
        },
        journal,
        resource.name
      )
    ).toThrow('temporary rule fields');
  });

  it('rejects a provider rule with a changed action', () => {
    expect(() =>
      verifyResource(
        {
          ...resource,
          temporaryRule: { ...resource.temporaryRule, action: 'allow' },
        },
        journal,
        resource.name
      )
    ).toThrow('temporary rule fields');
  });

  it('rejects a provider rule with a changed rate threshold', () => {
    expect(() =>
      verifyResource(
        {
          ...resource,
          temporaryRule: { ...resource.temporaryRule, threshold: 101 },
        },
        journal,
        resource.name
      )
    ).toThrow('temporary rule fields');
  });

  it('accepts an independently bound canonical hash when fields are unavailable', () => {
    const hashOnlyBinding = {
      id: REVIEWED_TEMPORARY_RULE_BINDING.id,
      canonicalSha256: REVIEWED_TEMPORARY_RULE_BINDING.canonicalSha256,
    };
    expect(() =>
      verifyResource(
        { ...resource, temporaryRule: hashOnlyBinding },
        journal,
        resource.name
      )
    ).not.toThrow();
  });

  it('rejects a missing temporary rule binding', () => {
    expect(() => verifyTemporaryRule(undefined as never)).toThrow(
      'missing its binding'
    );
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
