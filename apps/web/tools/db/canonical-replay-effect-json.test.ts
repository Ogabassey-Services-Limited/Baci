import { describe, expect, it } from 'vitest';
import { canonicalReplayEffectJson } from './canonical-replay-effect-json';

describe('canonicalReplayEffectJson', () => {
  it('canonicalizes multiline catalog bodies without fixture redaction rules', () => {
    expect(
      canonicalReplayEffectJson({
        functionBody:
          'CREATE FUNCTION register_push_token_rpc()\nRETURNS void\nLANGUAGE plpgsql',
        checks: {
          anonymousMerchantSecretProjectionWithheld: true,
          lock_domain_purchase_rpc_service_role: true,
        },
      })
    ).toBe(
      '{"checks":{"anonymousMerchantSecretProjectionWithheld":true,"lock_domain_purchase_rpc_service_role":true},"functionBody":"CREATE FUNCTION register_push_token_rpc()\\nRETURNS void\\nLANGUAGE plpgsql"}\n'
    );
  });

  it('still rejects values that JSON cannot represent deterministically', () => {
    expect(() =>
      canonicalReplayEffectJson({ functionBody: undefined })
    ).toThrow(/JSON/i);
  });
});
