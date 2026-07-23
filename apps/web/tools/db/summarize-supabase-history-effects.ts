import type { SupabaseHistoryEffectComponent } from './schemas/supabase-history-effect-component-schema';
import { supabaseHistoryEffectScope } from './supabase-history-effect-scope';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordArray(value: unknown): JsonRecord[] | undefined {
  return Array.isArray(value) && value.every(isRecord) ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sameStrings(
  actual: readonly string[] | undefined,
  expected: readonly string[]
): boolean {
  return (
    actual !== undefined &&
    JSON.stringify([...actual].sort(compareText)) ===
      JSON.stringify([...expected].sort(compareText))
  );
}

export function summarizeSupabaseHistoryEffects(
  components: readonly SupabaseHistoryEffectComponent[]
) {
  const scope = supabaseHistoryEffectScope;
  const byKey = new Map(
    components.map((component) => [
      `${component.category}\0${component.identity}`,
      component.value,
    ])
  );
  const value = (
    category: SupabaseHistoryEffectComponent['category'],
    identity: string
  ): JsonRecord | undefined => {
    const result = byKey.get(`${category}\0${identity}`);
    return isRecord(result) ? result : undefined;
  };
  const has = (
    category: SupabaseHistoryEffectComponent['category'],
    identity: string
  ) => byKey.has(`${category}\0${identity}`);

  const eventPolicyRolesExact =
    scope.eventPipeline.externalContracts.policies.every((identity) => {
      const policy = value('policy', identity);
      return (
        policy?.enabled === true &&
        sameStrings(stringArray(policy.roles), ['anon'])
      );
    });
  const everyDomainEventProducerDisabled =
    scope.eventPipeline.externalContracts.producerKeys.every(
      (identity) => value('producer-config', identity)?.enabled === false
    );
  const fulfillmentTimestampsReady = [
    'public.orders.delivered_at',
    'public.orders.shipped_at',
  ].every((identity) => {
    const column = value('selected-column', identity);
    return (
      column?.dataType === 'timestamp with time zone' &&
      column.notNull === false &&
      column.default === null
    );
  });
  const cancellationColumns = [
    'public.orders.cancellation_reason',
    'public.orders.cancelled_at',
    'public.orders.cancelled_by',
  ];
  const cancellationFunctions = Object.entries(
    scope.fulfillmentCancellation.functions
  ).map(([name, argumentsValue]) => `${name}(${argumentsValue})`);
  const customerCancellationSurfacePresent =
    cancellationColumns.every((identity) => has('selected-column', identity)) &&
    cancellationFunctions.every((identity) => has('function', identity)) &&
    has('constraint', 'public.orders.orders_cancelled_by_check') &&
    scope.fulfillmentCancellation.triggers.every((identity) =>
      has('trigger', identity)
    );

  const merchantSecurity = value(
    'relation-security',
    scope.merchantContainment.relation
  );
  const merchantGrants = value(
    'grant-vector',
    scope.merchantContainment.relation
  );
  const merchantTablePrivileges = recordArray(merchantGrants?.tablePrivileges);
  const merchantColumnPrivileges = recordArray(
    merchantGrants?.columnPrivileges
  );
  const anonColumns = merchantColumnPrivileges?.flatMap((grant) =>
    grant.role === 'anon' &&
    grant.privilege === 'SELECT' &&
    grant.grantable === false &&
    typeof grant.column === 'string'
      ? [grant.column]
      : []
  );
  const merchantAnonProjectionExact =
    merchantSecurity?.enabled === true &&
    merchantSecurity.forced === false &&
    merchantTablePrivileges?.length === 0 &&
    merchantColumnPrivileges !== undefined &&
    anonColumns?.length === merchantColumnPrivileges.length &&
    sameStrings(anonColumns, scope.merchantContainment.anonSelectableColumns);

  const featureSettingsGrants = value(
    'grant-vector',
    scope.merchantContainment.forbiddenFeatureSettingsRelation
  );
  const featureSettingsTablePrivileges = recordArray(
    featureSettingsGrants?.tablePrivileges
  );
  const featureSettingsColumnPrivileges = recordArray(
    featureSettingsGrants?.columnPrivileges
  );
  const merchantFeatureSettingsReadWithheld =
    featureSettingsTablePrivileges !== undefined &&
    featureSettingsColumnPrivileges !== undefined &&
    featureSettingsTablePrivileges.every(
      (grant) => grant.privilege !== 'SELECT'
    ) &&
    featureSettingsColumnPrivileges.every(
      (grant) => grant.privilege !== 'SELECT'
    );

  const queue = value(
    'pgmq-queue',
    `${scope.pgmq.schema}.${scope.pgmq.queueName}`
  );
  const queueMeta = isRecord(queue?.meta) ? queue.meta : undefined;
  const queueRelations = recordArray(queue?.relations);
  const pgmqDomainEventsQueuePresent =
    queueMeta?.present === true &&
    queueRelations?.length === scope.pgmq.relations.length &&
    queueRelations.every(
      (relation) =>
        relation.present === true &&
        typeof relation.name === 'string' &&
        scope.pgmq.relations.includes(
          relation.name as (typeof scope.pgmq.relations)[number]
        )
    );
  const pgmqProtectedRolesWithheld = scope.pgmq.protectedRoles.every((role) => {
    const access = value('pgmq-access', `${scope.pgmq.schema}.${role}`);
    return (
      access?.rolePresent === true &&
      access.effectiveSchemaUsage === false &&
      recordArray(access.schemaPrivileges)?.length === 0 &&
      recordArray(access.tablePrivileges)?.length === 0 &&
      recordArray(access.executeFunctions)?.length === 0 &&
      recordArray(access.effectiveTablePrivileges)?.length === 0 &&
      stringArray(access.effectiveExecuteFunctions)?.length === 0
    );
  });
  const pgmqPublicSchemaAbsent =
    value('schema-presence', scope.pgmq.forbiddenPublicApiSchema)?.present ===
    false;
  const requiredExtensionsPresent = scope.requiredExtensions.every(
    ({ name, schema }) => {
      const extension = value('extension', `${schema}.${name}`);
      return extension?.name === name && extension.schema === schema;
    }
  );

  return {
    componentCount: components.length,
    customerCancellationSurfacePresent,
    domainEventRpcCount: Object.keys(scope.eventPipeline.publicRpcs).length,
    eventPolicyRolesExact,
    everyDomainEventProducerDisabled,
    fulfillmentTimestampsReady,
    merchantAnonProjectionExact,
    merchantFeatureSettingsReadWithheld,
    pgmqDomainEventsQueuePresent,
    pgmqProtectedRolesWithheld,
    pgmqPublicSchemaAbsent,
    requiredExtensionsPresent,
  };
}
