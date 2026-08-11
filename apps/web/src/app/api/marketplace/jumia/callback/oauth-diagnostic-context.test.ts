import { describe, expect, it } from 'vitest';
import { parseJumiaOAuthDiagnosticContext } from './oauth-diagnostic-context';

describe('parseJumiaOAuthDiagnosticContext', () => {
  it('returns ordinary for an unbound state without a marker', () => {
    expect(
      parseJumiaOAuthDiagnosticContext({
        diagnosticId: undefined,
        storedState: 'ordinary-state',
      })
    ).toEqual({ status: 'ordinary' });
  });

  it('rejects a malformed marker on a diagnostic-bound state', () => {
    expect(
      parseJumiaOAuthDiagnosticContext({
        diagnosticId: 'not-a-uuid',
        storedState: 'diagnostic:state',
      })
    ).toEqual({ status: 'invalid' });
  });
});
