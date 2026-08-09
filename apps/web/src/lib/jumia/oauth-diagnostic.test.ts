import { describe, expect, it } from 'vitest';
import { jumiaOAuthDiagnostic } from '@/lib/jumia/oauth-diagnostic';

describe('Jumia OAuth diagnostic evidence', () => {
  it('reports refresh-token presence without exposing credential values', () => {
    const evidence = jumiaOAuthDiagnostic.buildEvidence({
      access_token: 'access-token-must-never-escape',
      expires_in: 3600,
      refresh_expires_in: 7200,
      refresh_token: 'refresh-token-must-never-escape',
      token_type: 'bearer',
    });

    expect(evidence).toEqual({
      expires_in: 3600,
      has_access_token: true,
      has_refresh_expires_in: true,
      has_refresh_token: true,
      persistence_skipped: true,
      refresh_expires_in: 7200,
      token_type: 'bearer',
    });
    expect(JSON.stringify(evidence)).not.toContain(
      'access-token-must-never-escape'
    );
    expect(JSON.stringify(evidence)).not.toContain(
      'refresh-token-must-never-escape'
    );
  });

  it('reports an access-token-only OAuth response', () => {
    expect(
      jumiaOAuthDiagnostic.buildEvidence({
        access_token: 'access-token-must-never-escape',
        expires_in: 3600,
        token_type: 'bearer',
      })
    ).toEqual({
      expires_in: 3600,
      has_access_token: true,
      has_refresh_expires_in: false,
      has_refresh_token: false,
      persistence_skipped: true,
      refresh_expires_in: null,
      token_type: 'bearer',
    });
  });

  it('builds a redirect query without exposing token values', () => {
    const query = jumiaOAuthDiagnostic.buildRedirectQuery({
      diagnosticId: 'diagnostic-id',
      tokens: {
        access_token: 'access-token-must-never-escape',
        expires_in: 3600,
        refresh_expires_in: 7200,
        refresh_token: 'refresh-token-must-never-escape',
        token_type: 'bearer',
      },
      variant: 'F',
    });

    expect(query).toEqual(
      expect.objectContaining({
        diagnostic_id: 'diagnostic-id',
        has_access_token: 'true',
        has_refresh_token: 'true',
        persistence_skipped: 'true',
        variant: 'F',
      })
    );
    expect(JSON.stringify(query)).not.toContain(
      'access-token-must-never-escape'
    );
    expect(JSON.stringify(query)).not.toContain(
      'refresh-token-must-never-escape'
    );
  });

  it('requires the exact diagnostic query value', () => {
    expect(
      jumiaOAuthDiagnostic.isRequested(
        new URLSearchParams('diagnostic=token-shape')
      )
    ).toBe(true);
    expect(
      jumiaOAuthDiagnostic.isRequested(new URLSearchParams('diagnostic=true'))
    ).toBe(false);
  });
});
