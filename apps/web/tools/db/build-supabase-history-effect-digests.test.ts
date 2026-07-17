import { describe, expect, it } from 'vitest';
import { buildSupabaseHistoryEffectDigests } from './build-supabase-history-effect-digests';

describe('buildSupabaseHistoryEffectDigests', () => {
  it('returns canonical component digests in stable category and identity order', () => {
    expect(
      buildSupabaseHistoryEffectDigests([
        {
          category: 'policy',
          identity: 'public.orders:read',
          value: {
            using: 'true',
            roles: ['anon', 'authenticated'],
          },
        },
        {
          category: 'function',
          identity: 'public.alpha()',
          value: { b: 2, a: 1 },
        },
      ])
    ).toEqual({
      digestVector: [
        {
          category: 'function',
          identity: 'public.alpha()',
          sha256:
            'e8d38819d39f705646bfb643368eca78f7db476c16471dbc33b941b27326410d',
        },
        {
          category: 'policy',
          identity: 'public.orders:read',
          sha256:
            'e38cec31b14f1b6596d8cbea2e20a1c59d3cd6c8f2258bfeb1ba89592af6c967',
        },
      ],
      effectSha256:
        '9672425c87506cae46cf16169c98c9e1ffd8e79bb48f29cd22960c10097025a8',
    });
  });

  it('rejects duplicate category and identity pairs', () => {
    expect(() =>
      buildSupabaseHistoryEffectDigests([
        {
          category: 'function',
          identity: 'public.alpha()',
          value: { body: 'first' },
        },
        {
          category: 'function',
          identity: 'public.alpha()',
          value: { body: 'second' },
        },
      ])
    ).toThrow(/duplicate.*function.*public\.alpha/i);
  });
});
