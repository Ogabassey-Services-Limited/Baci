import { describe, expect, it } from 'vitest';
import type { SupabaseHistoryEffectComponent } from './schemas/supabase-history-effect-component-schema';
import { summarizeSupabaseHistoryEffects } from './summarize-supabase-history-effects';
import { supabaseHistoryEffectScope } from './supabase-history-effect-scope';

type EffectCategory = SupabaseHistoryEffectComponent['category'];
type EffectIdentity = readonly [EffectCategory, string];
type EffectSummary = ReturnType<typeof summarizeSupabaseHistoryEffects>;
type SummaryDriftCase = readonly [
  category: EffectCategory,
  identity: string,
  value: SupabaseHistoryEffectComponent['value'],
  key: keyof EffectSummary,
];

function functionIdentities(
  functions: Readonly<Record<string, string>>
): string[] {
  return Object.entries(functions).map(
    ([name, identityArguments]) => `${name}(${identityArguments})`
  );
}

function effectIdentities(
  category: EffectCategory,
  identities: readonly string[]
): EffectIdentity[] {
  return identities.map((identity) => [category, identity]);
}

function components(): SupabaseHistoryEffectComponent[] {
  const scope = supabaseHistoryEffectScope;
  const values = [
    ...effectIdentities('event-relation', scope.eventPipeline.tables),
    ...effectIdentities('function', [
      ...functionIdentities(scope.eventPipeline.internalFunctions),
      ...functionIdentities(scope.eventPipeline.publicRpcs),
      ...functionIdentities(scope.fulfillmentCancellation.functions),
      ...functionIdentities(scope.duplicateHistoryFunctions),
    ]),
    ...effectIdentities('selected-column', [
      ...scope.eventPipeline.externalContracts.columns,
      ...scope.fulfillmentCancellation.columns,
    ]),
    ...effectIdentities(
      'constraint',
      scope.fulfillmentCancellation.constraints
    ),
    ...effectIdentities('index', scope.eventPipeline.externalContracts.indexes),
    ...effectIdentities('policy', [
      ...scope.eventPipeline.externalContracts.policies,
      `${scope.merchantContainment.relation}.${scope.merchantContainment.anonPolicy}`,
    ]),
    ...effectIdentities('trigger', [
      ...scope.eventPipeline.externalContracts.triggers,
      ...scope.fulfillmentCancellation.triggers,
    ]),
    ...effectIdentities(
      'producer-config',
      scope.eventPipeline.externalContracts.producerKeys
    ),
    ...effectIdentities('relation-security', [
      scope.merchantContainment.relation,
    ]),
    ...effectIdentities('grant-vector', [
      scope.merchantContainment.relation,
      scope.merchantContainment.forbiddenFeatureSettingsRelation,
    ]),
    ...scope.requiredExtensions.map(
      ({ name, schema }) =>
        ['extension', `${schema}.${name}`] satisfies EffectIdentity
    ),
    ...effectIdentities('pgmq-queue', [
      `${scope.pgmq.schema}.${scope.pgmq.queueName}`,
    ]),
    ...effectIdentities(
      'pgmq-access',
      scope.pgmq.protectedRoles.map((role) => `${scope.pgmq.schema}.${role}`)
    ),
    ...effectIdentities('schema-presence', [
      scope.pgmq.forbiddenPublicApiSchema,
    ]),
  ];
  return values.map(([category, identity]) => ({
    category,
    identity,
    value: {},
  }));
}

function safeComponents(): SupabaseHistoryEffectComponent[] {
  const scope = supabaseHistoryEffectScope;
  const values = components();
  const set = (
    category: SupabaseHistoryEffectComponent['category'],
    identity: string,
    value: SupabaseHistoryEffectComponent['value']
  ) => {
    const component = values.find(
      (entry) => entry.category === category && entry.identity === identity
    );
    if (!component) throw new Error('missing test component');
    component.value = value;
  };
  for (const identity of scope.eventPipeline.externalContracts.policies) {
    set('policy', identity, {
      enabled: true,
      forced: false,
      roles: ['anon'],
    });
  }
  for (const identity of scope.eventPipeline.externalContracts.producerKeys) {
    set('producer-config', identity, { enabled: false, shadowOnly: true });
  }
  for (const identity of [
    'public.orders.delivered_at',
    'public.orders.shipped_at',
  ]) {
    set('selected-column', identity, {
      dataType: 'timestamp with time zone',
      default: null,
      notNull: false,
    });
  }
  set('relation-security', scope.merchantContainment.relation, {
    enabled: true,
    forced: false,
  });
  set('grant-vector', scope.merchantContainment.relation, {
    columnPrivileges: scope.merchantContainment.anonSelectableColumns.map(
      (column) => ({
        column,
        grantable: false,
        privilege: 'SELECT',
        role: 'anon',
      })
    ),
    tablePrivileges: [],
  });
  set(
    'grant-vector',
    scope.merchantContainment.forbiddenFeatureSettingsRelation,
    {
      columnPrivileges: [],
      tablePrivileges: [
        {
          grantable: false,
          privilege: 'UPDATE',
          role: 'anon',
        },
      ],
    }
  );
  for (const { name, schema } of scope.requiredExtensions) {
    set('extension', `${schema}.${name}`, { name, schema });
  }
  set('pgmq-queue', `${scope.pgmq.schema}.${scope.pgmq.queueName}`, {
    meta: { isPartitioned: false, isUnlogged: false, present: true },
    relations: scope.pgmq.relations.map((name) => ({ name, present: true })),
  });
  for (const role of scope.pgmq.protectedRoles) {
    set('pgmq-access', `${scope.pgmq.schema}.${role}`, {
      effectiveExecuteFunctions: [],
      effectiveSchemaUsage: false,
      effectiveTablePrivileges: [],
      executeFunctions: [],
      rolePresent: true,
      schemaPrivileges: [],
      tablePrivileges: [],
    });
  }
  set('schema-presence', scope.pgmq.forbiddenPublicApiSchema, {
    present: false,
  });
  return values;
}

describe('summarizeSupabaseHistoryEffects', () => {
  it('derives the exact safe v3 semantic summary', () => {
    expect(summarizeSupabaseHistoryEffects(safeComponents())).toEqual({
      componentCount: 76,
      customerCancellationSurfacePresent: true,
      domainEventRpcCount: 19,
      eventPolicyRolesExact: true,
      everyDomainEventProducerDisabled: true,
      fulfillmentTimestampsReady: true,
      merchantAnonProjectionExact: true,
      merchantFeatureSettingsReadWithheld: true,
      pgmqDomainEventsQueuePresent: true,
      pgmqProtectedRolesWithheld: true,
      pgmqPublicSchemaAbsent: true,
      requiredExtensionsPresent: true,
    });
  });

  it('fails each safety summary closed when material values drift', () => {
    const cases: SummaryDriftCase[] = [
      [
        'policy',
        'public.analytics_events.Event ingress capability inserts analytics events',
        { enabled: true, roles: ['service_role'] },
        'eventPolicyRolesExact',
      ],
      [
        'producer-config',
        'commerce.orders',
        { enabled: true },
        'everyDomainEventProducerDisabled',
      ],
      [
        'selected-column',
        'public.orders.shipped_at',
        {
          dataType: 'timestamp without time zone',
          default: null,
          notNull: false,
        },
        'fulfillmentTimestampsReady',
      ],
      [
        'grant-vector',
        'public.merchant_feature_settings',
        {
          columnPrivileges: [
            {
              column: 'id',
              grantable: false,
              privilege: 'SELECT',
              role: 'anon',
            },
          ],
          tablePrivileges: [],
        },
        'merchantFeatureSettingsReadWithheld',
      ],
      [
        'schema-presence',
        'pgmq_public',
        { present: true },
        'pgmqPublicSchemaAbsent',
      ],
    ];
    for (const [category, identity, value, key] of cases) {
      const changed = safeComponents();
      const component = changed.find(
        (entry) => entry.category === category && entry.identity === identity
      );
      if (!component) throw new Error('missing test component');
      component.value = value;
      expect(summarizeSupabaseHistoryEffects(changed)[key]).toBe(false);
    }
  });
});
