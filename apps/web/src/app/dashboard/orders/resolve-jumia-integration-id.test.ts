import { describe, expect, it } from 'vitest';
import { resolveJumiaIntegrationId } from './resolve-jumia-integration-id';

describe('resolveJumiaIntegrationId', () => {
  it('uses a valid integration selected by the scoped orders link', () => {
    expect(
      resolveJumiaIntegrationId(
        [{ id: 'integration-1' }, { id: 'integration-2' }],
        'integration-2'
      )
    ).toBe('integration-2');
  });

  it('rejects an unknown scoped integration instead of choosing another shop', () => {
    expect(
      resolveJumiaIntegrationId(
        [{ id: 'integration-1' }, { id: 'integration-2' }],
        'stale-integration'
      )
    ).toBeNull();
  });

  it('falls back to the only active integration when no scope is requested', () => {
    expect(resolveJumiaIntegrationId([{ id: 'integration-1' }], null)).toBe(
      'integration-1'
    );
  });
});
