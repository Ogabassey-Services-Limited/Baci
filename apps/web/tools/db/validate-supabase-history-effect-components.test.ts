import { describe, expect, it } from 'vitest';
import { supabaseHistoryEffectScope } from './supabase-history-effect-scope';
import { validateSupabaseHistoryEffectComponents } from './validate-supabase-history-effect-components';

function functionIdentities(
  functions: Readonly<Record<string, string>>
): string[] {
  return Object.entries(functions).map(
    ([name, identityArguments]) => `${name}(${identityArguments})`
  );
}

function validComponents() {
  const scope = supabaseHistoryEffectScope;
  return [
    ...scope.eventPipeline.tables.map((identity) => ({
      category: 'event-relation',
      identity,
      value: {},
    })),
    ...[
      ...functionIdentities(scope.eventPipeline.internalFunctions),
      ...functionIdentities(scope.eventPipeline.publicRpcs),
      ...functionIdentities(scope.fulfillmentCancellation.functions),
      ...functionIdentities(scope.duplicateHistoryFunctions),
    ].map((identity) => ({ category: 'function', identity, value: {} })),
    ...[
      ...scope.eventPipeline.externalContracts.columns,
      ...scope.fulfillmentCancellation.columns,
    ].map((identity) => ({
      category: 'selected-column',
      identity,
      value: {},
    })),
    ...scope.fulfillmentCancellation.constraints.map((identity) => ({
      category: 'constraint',
      identity,
      value: {},
    })),
    ...scope.eventPipeline.externalContracts.indexes.map((identity) => ({
      category: 'index',
      identity,
      value: {},
    })),
    ...[
      ...scope.eventPipeline.externalContracts.policies,
      `${scope.merchantContainment.relation}.${scope.merchantContainment.anonPolicy}`,
    ].map((identity) => ({ category: 'policy', identity, value: {} })),
    ...[
      ...scope.eventPipeline.externalContracts.triggers,
      ...scope.fulfillmentCancellation.triggers,
    ].map((identity) => ({ category: 'trigger', identity, value: {} })),
    ...scope.eventPipeline.externalContracts.producerKeys.map((identity) => ({
      category: 'producer-config',
      identity,
      value: {},
    })),
    {
      category: 'relation-security',
      identity: scope.merchantContainment.relation,
      value: {},
    },
    ...[
      scope.merchantContainment.relation,
      scope.merchantContainment.forbiddenFeatureSettingsRelation,
    ].map((identity) => ({ category: 'grant-vector', identity, value: {} })),
    ...scope.requiredExtensions.map(({ name, schema }) => ({
      category: 'extension',
      identity: `${schema}.${name}`,
      value: {},
    })),
    {
      category: 'pgmq-queue',
      identity: `${scope.pgmq.schema}.${scope.pgmq.queueName}`,
      value: {},
    },
    ...scope.pgmq.protectedRoles.map((role) => ({
      category: 'pgmq-access',
      identity: `${scope.pgmq.schema}.${role}`,
      value: {},
    })),
    {
      category: 'schema-presence',
      identity: scope.pgmq.forbiddenPublicApiSchema,
      value: {},
    },
  ];
}

describe('validateSupabaseHistoryEffectComponents', () => {
  it('accepts the exact manifest identity set regardless of input order', () => {
    const components = validComponents().reverse();
    const validated = validateSupabaseHistoryEffectComponents(components);

    expect(validated).toHaveLength(76);
    expect(validated[0]).toMatchObject({
      category: 'constraint',
      identity: 'public.orders.orders_cancelled_by_check',
    });
  });

  it('returns canonical identities in deterministic code-unit order', () => {
    const validated = validateSupabaseHistoryEffectComponents(
      validComponents().reverse()
    );

    expect(
      validated
        .filter(({ category }) => category === 'pgmq-access')
        .map(({ identity }) => identity)
    ).toEqual([
      'pgmq.PUBLIC',
      'pgmq.anon',
      'pgmq.authenticated',
      'pgmq.service_role',
    ]);
  });

  it('rejects missing, additional, and duplicate identities', () => {
    const components = validComponents();
    expect(() =>
      validateSupabaseHistoryEffectComponents(components.slice(1))
    ).toThrow('effect component scope mismatch');
    expect(() =>
      validateSupabaseHistoryEffectComponents([
        ...components,
        { category: 'function', identity: 'public.extra()', value: {} },
      ])
    ).toThrow('effect component scope mismatch');
    expect(() =>
      validateSupabaseHistoryEffectComponents([
        ...components,
        components[0] as (typeof components)[number],
      ])
    ).toThrow('duplicate effect component identity');
  });
});
