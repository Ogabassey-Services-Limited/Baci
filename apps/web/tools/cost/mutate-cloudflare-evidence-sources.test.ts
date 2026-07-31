import { describe, expect, it } from 'vitest';
import { parseMutationArguments } from './mutate-cloudflare-evidence-sources';

describe('parseMutationArguments', () => {
  it('requires an explicit apply run and refuses measurement modes', () => {
    expect(parseMutationArguments(['--run', 'run-123', '--apply']).mode).toBe(
      'apply'
    );
    expect(() =>
      parseMutationArguments(['--run', 'run-123', '--measure'])
    ).toThrow('apply');
  });
});
