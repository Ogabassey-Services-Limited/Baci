import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalReplayEffectJson } from '../canonical-replay-effect-json';
import { supabaseHistoryEffectScope } from '../supabase-history-effect-scope';
import { productionHistoryEffectsSchema } from './production-history-effects-schema';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function functionIdentities(
  functions: Readonly<Record<string, string>>
): string[] {
  return Object.entries(functions).map(
    ([name, identityArguments]) => `${name}(${identityArguments})`
  );
}

function digestIdentities() {
  const scope = supabaseHistoryEffectScope;
  return [
    ...scope.eventPipeline.tables.map((identity) => ({
      category: 'event-relation',
      identity,
    })),
    ...[
      ...functionIdentities(scope.eventPipeline.internalFunctions),
      ...functionIdentities(scope.eventPipeline.publicRpcs),
      ...functionIdentities(scope.fulfillmentCancellation.functions),
      ...functionIdentities(scope.duplicateHistoryFunctions),
    ].map((identity) => ({ category: 'function', identity })),
    ...[
      ...scope.eventPipeline.externalContracts.columns,
      ...scope.fulfillmentCancellation.columns,
    ].map((identity) => ({ category: 'selected-column', identity })),
    ...scope.fulfillmentCancellation.constraints.map((identity) => ({
      category: 'constraint',
      identity,
    })),
    ...scope.eventPipeline.externalContracts.indexes.map((identity) => ({
      category: 'index',
      identity,
    })),
    ...[
      ...scope.eventPipeline.externalContracts.policies,
      `${scope.merchantContainment.relation}.${scope.merchantContainment.anonPolicy}`,
    ].map((identity) => ({ category: 'policy', identity })),
    ...[
      ...scope.eventPipeline.externalContracts.triggers,
      ...scope.fulfillmentCancellation.triggers,
    ].map((identity) => ({ category: 'trigger', identity })),
    ...scope.eventPipeline.externalContracts.producerKeys.map((identity) => ({
      category: 'producer-config',
      identity,
    })),
    {
      category: 'relation-security',
      identity: scope.merchantContainment.relation,
    },
    ...[
      scope.merchantContainment.relation,
      scope.merchantContainment.forbiddenFeatureSettingsRelation,
    ].map((identity) => ({ category: 'grant-vector', identity })),
    ...scope.requiredExtensions.map(({ name, schema }) => ({
      category: 'extension',
      identity: `${schema}.${name}`,
    })),
    {
      category: 'pgmq-queue',
      identity: `${scope.pgmq.schema}.${scope.pgmq.queueName}`,
    },
    ...scope.pgmq.protectedRoles.map((role) => ({
      category: 'pgmq-access',
      identity: `${scope.pgmq.schema}.${role}`,
    })),
    {
      category: 'schema-presence',
      identity: scope.pgmq.forbiddenPublicApiSchema,
    },
  ].sort((left, right) => {
    const leftKey = `${left.category}\0${left.identity}`;
    const rightKey = `${right.category}\0${right.identity}`;
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    return 0;
  });
}

function validFixture() {
  const digestVector = digestIdentities().map((entry) => ({
    ...entry,
    sha256: sha256(entry.identity),
  }));
  return {
    schemaVersion: 2,
    baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47',
    source: {
      kind: 'supabase-management-api-read-only',
      querySha256: 'c'.repeat(64),
      serverVersionNum: 170006,
    },
    scope: {
      version: 'baci-p0-effects-v3',
      manifestSha256:
        'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245',
      componentCount: 76,
    },
    diagnostics: {
      extensionVersions: [
        { name: 'pgcrypto', schema: 'extensions', version: '1.3' },
        { name: 'pgmq', schema: 'pgmq', version: '1.5.1' },
      ],
    },
    ledger: { rowCount: 442, tailVersion: '20260714225503' },
    digestVector,
    effectSha256: sha256(canonicalReplayEffectJson(digestVector)),
    effects: {
      componentCount: 76,
      domainEventRpcCount: 19,
      eventPolicyRolesExact: true,
      everyDomainEventProducerDisabled: true,
      fulfillmentTimestampsReady: true,
      customerCancellationSurfacePresent: true,
      merchantAnonProjectionExact: true,
      merchantFeatureSettingsReadWithheld: true,
      pgmqDomainEventsQueuePresent: true,
      pgmqProtectedRolesWithheld: true,
      pgmqPublicSchemaAbsent: true,
      requiredExtensionsPresent: true,
    },
  };
}

describe('productionHistoryEffectsSchema', () => {
  it('accepts the exact v3 digest-only production receipt', () => {
    const parsed = productionHistoryEffectsSchema.parse(validFixture());
    expect(parsed.digestVector).toHaveLength(76);
    expect(JSON.stringify(parsed)).not.toContain('CREATE FUNCTION');
  });

  it('rejects missing, reordered, duplicate, or additional component identities', () => {
    for (const mutate of [
      (fixture: ReturnType<typeof validFixture>) => fixture.digestVector.pop(),
      (fixture: ReturnType<typeof validFixture>) =>
        fixture.digestVector.reverse(),
      (fixture: ReturnType<typeof validFixture>) =>
        fixture.digestVector.push(fixture.digestVector[0]),
      (fixture: ReturnType<typeof validFixture>) =>
        fixture.digestVector.push({
          category: 'function',
          identity: 'public.unreviewed()',
          sha256: 'd'.repeat(64),
        }),
    ]) {
      const fixture = validFixture();
      mutate(fixture);
      expect(() => productionHistoryEffectsSchema.parse(fixture)).toThrow();
    }
  });

  it('cryptographically binds the overall hash and rejects raw or unknown fields', () => {
    const badHash = validFixture();
    badHash.effectSha256 = 'f'.repeat(64);
    expect(() => productionHistoryEffectsSchema.parse(badHash)).toThrow();

    const raw = validFixture() as Record<string, unknown>;
    raw.rawSnapshot = 'CREATE FUNCTION private.leak()';
    expect(() => productionHistoryEffectsSchema.parse(raw)).toThrow();
  });

  it('requires safe semantic literals and only the two ordered extension diagnostics', () => {
    const unsafe = validFixture();
    unsafe.effects.eventPolicyRolesExact = false;
    expect(() => productionHistoryEffectsSchema.parse(unsafe)).toThrow();

    const unrelated = validFixture();
    unrelated.diagnostics.extensionVersions.push({
      name: 'postgis',
      schema: 'extensions',
      version: '3.3.7',
    });
    expect(() => productionHistoryEffectsSchema.parse(unrelated)).toThrow();

    const reordered = validFixture();
    reordered.diagnostics.extensionVersions.reverse();
    expect(() => productionHistoryEffectsSchema.parse(reordered)).toThrow();
  });
});
