import { describe, expect, it } from 'vitest';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal';
import {
  parseMutationArguments,
  verifyResource,
} from './mutate-cloudflare-evidence-validation';

const runId = '0123456789abcdef0123456789abcdef';
const journal = {
  runId,
  accountId: 'account',
  zoneId: 'zone',
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
});
